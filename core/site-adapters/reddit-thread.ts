import type { ExtractionCandidate } from '../extraction-candidate-orchestrator.js';

export interface RedditPost {
  id?: string;
  title: string;
  author?: string;
  score?: string;
  timestamp?: string;
  bodyHtml: string;
}

export interface RedditCommentNode {
  id?: string;
  author?: string;
  score?: string;
  timestamp?: string;
  bodyHtml: string;
  children: RedditCommentNode[];
  depth: number;
  isAutoSummary?: boolean;
  isBotLike?: boolean;
}

export interface RedditThreadDiagnostics {
  redditMode: 'full_thread_default';
  postCaptured: boolean;
  commentCount: number;
  maxDepth: number;
  candidates: string[];
  winner: string;
  autoSummaryDetected: boolean;
  botLikeCommentsDetected: number;
  contentRemoved: false;
}

export interface RedditThread {
  post: RedditPost;
  comments: RedditCommentNode[];
  diagnostics: RedditThreadDiagnostics;
}

export interface RedditThreadCandidateSet {
  candidates: ExtractionCandidate[];
  diagnostics: RedditThreadDiagnostics;
}

const COMMENT_LIMIT = 80;

export function parseRedditThreadFromJson(payload: unknown): RedditThread | null {
  const listings = Array.isArray(payload) ? payload : [payload];
  let post: RedditPost | null = null;
  const comments: RedditCommentNode[] = [];

  for (const listing of listings) {
    const children = (listing as any)?.data?.children;
    if (!Array.isArray(children)) {
      continue;
    }

    for (const child of children) {
      const kind = typeof child?.kind === 'string' ? child.kind : '';
      const data = child?.data;
      if (!data || typeof data !== 'object') {
        continue;
      }

      if (kind === 't3' || (!kind && typeof data.selftext === 'string')) {
        const body = normalizeRedditText(
          typeof data.selftext === 'string'
            ? data.selftext
            : (typeof data.selftext_html === 'string' ? stripHtml(data.selftext_html) : '')
        );
        if (body.length < 40) {
          continue;
        }

        post = {
          id: typeof data.id === 'string' ? data.id : undefined,
          title: typeof data.title === 'string' ? data.title : '',
          author: typeof data.author === 'string' ? data.author : undefined,
          score: formatScore(data.score),
          timestamp: formatTimestamp(data.created_utc),
          bodyHtml: renderMarkdownishBlocks(body),
        };
        continue;
      }

      if (kind === 't1' && post && comments.length < COMMENT_LIMIT) {
        const node = parseCommentNode(child, 0, () => countCommentNodes(comments));
        if (node) {
          comments.push(node);
        }
      }
    }
  }

  if (!post) {
    return null;
  }

  const flattened = flattenComments(comments);
  const diagnostics: RedditThreadDiagnostics = {
    redditMode: 'full_thread_default',
    postCaptured: true,
    commentCount: flattened.length,
    maxDepth: flattened.reduce((max, comment) => Math.max(max, comment.depth), 0),
    candidates: ['reddit:post', 'reddit:comments', 'reddit:thread'],
    winner: 'reddit:thread',
    autoSummaryDetected: flattened.some((comment) => comment.isAutoSummary),
    botLikeCommentsDetected: flattened.filter((comment) => comment.isBotLike).length,
    contentRemoved: false,
  };

  return { post, comments, diagnostics };
}

export function buildRedditThreadCandidates(thread: RedditThread): RedditThreadCandidateSet {
  const postHtml = renderPostHtml(thread.post, 'reddit:post');
  const commentsHtml = renderCommentsSectionHtml(thread.comments);
  const threadHtml = `<article data-pr-source="reddit:thread">${renderPostInnerHtml(thread.post)}${commentsHtml}</article>`;

  return {
    diagnostics: thread.diagnostics,
    candidates: [
      createCandidate('reddit:thread', threadHtml, 0.96),
      createCandidate('reddit:post', postHtml, 0.9),
      createCandidate('reddit:comments', commentsHtml, 0.78),
    ],
  };
}

function parseCommentNode(child: any, depth: number, currentCount: () => number): RedditCommentNode | null {
  if (currentCount() >= COMMENT_LIMIT || depth > 8) {
    return null;
  }

  const data = child?.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const body = normalizeRedditText(
    typeof data.body === 'string'
      ? data.body
      : (typeof data.body_html === 'string' ? stripHtml(data.body_html) : '')
  );
  if (body.length < 1) {
    return null;
  }

  const isAutoSummary = /tl;dr of the discussion generated automatically/i.test(body);
  const author = typeof data.author === 'string' ? data.author : undefined;
  const node: RedditCommentNode = {
    id: typeof data.id === 'string' ? data.id : undefined,
    author,
    score: formatScore(data.score),
    timestamp: formatTimestamp(data.created_utc),
    bodyHtml: renderMarkdownishBlocks(body),
    children: [],
    depth,
    isAutoSummary,
    isBotLike: Boolean(author && /bot$/i.test(author)),
  };

  const replies = data.replies?.data?.children;
  if (Array.isArray(replies)) {
    for (const reply of replies) {
      if (reply?.kind !== 't1') {
        continue;
      }
      const childNode = parseCommentNode(reply, depth + 1, currentCount);
      if (childNode) {
        node.children.push(childNode);
      }
    }
  }

  return node;
}

function renderPostHtml(post: RedditPost, source: string): string {
  return `<article data-pr-source="${source}">${renderPostInnerHtml(post)}</article>`;
}

function renderPostInnerHtml(post: RedditPost): string {
  const titleHtml = post.title.trim() ? `<h1>${escapeHtml(post.title.trim())}</h1>` : '';
  return `${titleHtml}${post.bodyHtml}`;
}

function renderCommentsSectionHtml(comments: RedditCommentNode[]): string {
  if (comments.length === 0) {
    return '';
  }

  return `<section data-pr-source="reddit:comments"><h2>Comments</h2>${comments
    .map((comment) => renderCommentHtml(comment))
    .join('\n')}</section>`;
}

function renderCommentHtml(comment: RedditCommentNode): string {
  const headingText = comment.isAutoSummary
    ? 'Reddit summary · generated automatically'
    : [
        comment.depth > 0 ? `Reply from ${formatAuthor(comment.author)}` : formatAuthor(comment.author),
        comment.score,
        comment.timestamp,
      ].filter(Boolean).join(' · ');

  if (comment.depth >= 4) {
    return `<blockquote><p><strong>${escapeHtml(headingText)}</strong></p>${comment.bodyHtml}${comment.children
      .map((child) => renderCommentHtml(child))
      .join('\n')}</blockquote>`;
  }

  const level = Math.min(6, 3 + comment.depth);
  return `<section data-pr-comment-depth="${comment.depth}"><h${level}>${escapeHtml(headingText)}</h${level}>${comment.bodyHtml}${comment.children
    .map((child) => renderCommentHtml(child))
    .join('\n')}</section>`;
}

function renderMarkdownishBlocks(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((block) => normalizeRedditText(block))
    .filter(Boolean)
    .map((block) => renderBlock(block))
    .join('\n');
}

function renderBlock(block: string): string {
  const listParts = splitInlineOrderedList(block);
  if (listParts) {
    const prefixHtml = listParts.prefix ? `<p>${renderInlineMarkdown(listParts.prefix)}</p>` : '';
    const listHtml = `<ol>${listParts.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ol>`;
    return `${prefixHtml}${listHtml}`;
  }

  return `<p>${renderInlineMarkdown(block)}</p>`;
}

function splitInlineOrderedList(block: string): { prefix: string; items: string[] } | null {
  const markers = Array.from(block.matchAll(/(?:^|\s)(\d+)\.\s+/g));
  if (markers.length < 2 || markers[0][1] !== '1') {
    return null;
  }

  const prefix = block.slice(0, markers[0].index).trim();
  const items = markers.map((marker, index) => {
    const start = (marker.index || 0) + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index || block.length : block.length;
    return block.slice(start, end).trim();
  }).filter(Boolean);

  return items.length >= 2 ? { prefix, items } : null;
}

function renderInlineMarkdown(value: string): string {
  const pieces: string[] = [];
  let lastIndex = 0;
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of value.matchAll(linkPattern)) {
    const index = match.index || 0;
    pieces.push(escapeHtml(value.slice(lastIndex, index)));
    pieces.push(`<a href="${escapeAttribute(match[2])}">${escapeHtml(match[1])}</a>`);
    lastIndex = index + match[0].length;
  }
  pieces.push(escapeHtml(value.slice(lastIndex)));
  return pieces.join('');
}

function createCandidate(source: string, html: string, confidence: number): ExtractionCandidate {
  const text = stripHtml(html);
  return {
    source,
    html,
    metrics: {
      charCount: text.length,
      paragraphCount: Math.max(1, (html.match(/<(p|li|blockquote)\b/gi) || []).length),
      codeCharCount: stripHtml((html.match(/<(pre|code)\b[\s\S]*?<\/\1>/gi) || []).join('\n')).length,
      linkDensity: calculateLinkDensity(html),
      confidence,
    },
  };
}

function flattenComments(comments: RedditCommentNode[]): RedditCommentNode[] {
  const flattened: RedditCommentNode[] = [];
  for (const comment of comments) {
    flattened.push(comment);
    flattened.push(...flattenComments(comment.children));
  }
  return flattened;
}

function countCommentNodes(comments: RedditCommentNode[]): number {
  return flattenComments(comments).length;
}

function normalizeRedditText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function formatAuthor(author?: string): string {
  return author ? `u/${author}` : 'Unknown redditor';
}

function formatScore(score: unknown): string | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return undefined;
  }
  return `${score} ${score === 1 ? 'point' : 'points'}`;
}

function formatTimestamp(createdUtc: unknown): string | undefined {
  if (typeof createdUtc !== 'number' || !Number.isFinite(createdUtc)) {
    return undefined;
  }
  return new Date(createdUtc * 1000).toISOString();
}

function calculateLinkDensity(html: string): number {
  const textLength = stripHtml(html).length;
  if (textLength === 0) {
    return 0;
  }
  const linkText = Array.from(html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => stripHtml(match[1]))
    .join(' ');
  return Math.min(1, linkText.length / textLength);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
