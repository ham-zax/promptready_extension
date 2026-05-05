import type { ExtractionCandidate } from '../extraction-candidate-orchestrator.js';

export interface RedditPost {
  id?: string;
  title: string;
  author?: string;
  score?: string;
  timestamp?: string;
  url?: string;
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
  contentRemoved: boolean;
  truncated: boolean;
  commentLimit: number;
  maxDepthLimit: number;
  omittedCommentCount: number;
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
const MAX_COMMENT_DEPTH = 8;
const REDDIT_JSON_POST_SOURCE = 'reddit-json:post';
const REDDIT_JSON_COMMENTS_SOURCE = 'reddit-json:comments';
const REDDIT_JSON_THREAD_SOURCE = 'reddit-json:thread';

type JsonRecord = Record<string, unknown>;

interface CommentParseState {
  acceptedCount: number;
  omittedCount: number;
  maxDepthSeen: number;
}

export function parseRedditThreadFromJson(payload: unknown): RedditThread | null {
  const listings = Array.isArray(payload) ? payload : [payload];
  let post: RedditPost | null = null;
  const comments: RedditCommentNode[] = [];
  const commentState: CommentParseState = {
    acceptedCount: 0,
    omittedCount: 0,
    maxDepthSeen: 0,
  };

  for (const listing of listings) {
    const children = getListingChildren(listing);
    if (!Array.isArray(children)) {
      continue;
    }

    for (const child of children) {
      const childRecord = asRecord(child);
      const kind = getString(childRecord, 'kind') || '';
      const data = asRecord(childRecord?.data);
      if (!data) {
        continue;
      }

      if (kind === 't3' || (!kind && typeof data.selftext === 'string')) {
        const body = normalizeRedditText(
          typeof data.selftext === 'string'
            ? data.selftext
            : (typeof data.selftext_html === 'string' ? stripHtml(data.selftext_html) : '')
        );
        const title = getString(data, 'title') || '';
        const url = getPostUrl(data);
        if (!body && !title.trim() && !url) {
          continue;
        }

        post = {
          id: getString(data, 'id'),
          title,
          author: getString(data, 'author'),
          score: formatScore(data.score),
          timestamp: formatTimestamp(data.created_utc),
          url,
          bodyHtml: renderMarkdownishBlocks(body),
        };
        continue;
      }

      if (kind === 't1' && post) {
        const node = parseCommentNode(child, 0, commentState);
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
  const truncated = commentState.omittedCount > 0;
  const diagnostics: RedditThreadDiagnostics = {
    redditMode: 'full_thread_default',
    postCaptured: true,
    commentCount: flattened.length,
    maxDepth: commentState.maxDepthSeen,
    candidates: [REDDIT_JSON_POST_SOURCE, REDDIT_JSON_COMMENTS_SOURCE, REDDIT_JSON_THREAD_SOURCE],
    winner: REDDIT_JSON_THREAD_SOURCE,
    autoSummaryDetected: flattened.some((comment) => comment.isAutoSummary),
    botLikeCommentsDetected: flattened.filter((comment) => comment.isBotLike).length,
    contentRemoved: truncated,
    truncated,
    commentLimit: COMMENT_LIMIT,
    maxDepthLimit: MAX_COMMENT_DEPTH,
    omittedCommentCount: commentState.omittedCount,
  };

  return { post, comments, diagnostics };
}

export function buildRedditThreadCandidates(thread: RedditThread): RedditThreadCandidateSet {
  const postHtml = renderPostHtml(thread.post, REDDIT_JSON_POST_SOURCE);
  const commentsHtml = renderCommentsSectionHtml(thread.comments);
  const threadHtml = `<article data-pr-source="${REDDIT_JSON_THREAD_SOURCE}">${renderPostInnerHtml(thread.post)}${commentsHtml}</article>`;

  return {
    diagnostics: thread.diagnostics,
    candidates: [
      createCandidate(REDDIT_JSON_THREAD_SOURCE, threadHtml, 0.96),
      createCandidate(REDDIT_JSON_POST_SOURCE, postHtml, 0.9),
      createCandidate(REDDIT_JSON_COMMENTS_SOURCE, commentsHtml, 0.78),
    ],
  };
}

function parseCommentNode(child: unknown, depth: number, state: CommentParseState): RedditCommentNode | null {
  if (state.acceptedCount >= COMMENT_LIMIT || depth > MAX_COMMENT_DEPTH) {
    state.omittedCount += countJsonCommentNodes(child);
    return null;
  }

  const childRecord = asRecord(child);
  if (getString(childRecord, 'kind') !== 't1') {
    return null;
  }

  const data = asRecord(childRecord?.data);
  if (!data) {
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
  const author = getString(data, 'author');
  state.acceptedCount += 1;
  state.maxDepthSeen = Math.max(state.maxDepthSeen, depth);

  const node: RedditCommentNode = {
    id: getString(data, 'id'),
    author,
    score: formatScore(data.score),
    timestamp: formatTimestamp(data.created_utc),
    bodyHtml: renderMarkdownishBlocks(body),
    children: [],
    depth,
    isAutoSummary,
    isBotLike: Boolean(author && /bot$/i.test(author)),
  };

  for (const reply of getReplyChildren(data)) {
    const childNode = parseCommentNode(reply, depth + 1, state);
    if (childNode) {
      node.children.push(childNode);
    }
  }

  return node;
}

function renderPostHtml(post: RedditPost, source: string): string {
  return `<article data-pr-source="${source}">${renderPostInnerHtml(post)}</article>`;
}

function renderPostInnerHtml(post: RedditPost): string {
  const titleHtml = post.title.trim() ? `<h1>${escapeHtml(post.title.trim())}</h1>` : '';
  const linkHtml = post.url ? `<p><a href="${escapeAttribute(post.url)}">${escapeHtml(post.url)}</a></p>` : '';
  return `${titleHtml}${post.bodyHtml}${linkHtml}`;
}

function renderCommentsSectionHtml(comments: RedditCommentNode[]): string {
  if (comments.length === 0) {
    return '';
  }

  return `<section data-pr-source="${REDDIT_JSON_COMMENTS_SOURCE}"><h2>Comments</h2>${comments
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

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? value as JsonRecord : null;
}

function getString(record: JsonRecord | null | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getListingChildren(listing: unknown): unknown[] | null {
  const listingRecord = asRecord(listing);
  const data = asRecord(listingRecord?.data);
  const children = data?.children;
  return Array.isArray(children) ? children : null;
}

function getReplyChildren(data: JsonRecord): unknown[] {
  const replies = asRecord(data.replies);
  const replyData = asRecord(replies?.data);
  const children = replyData?.children;
  return Array.isArray(children) ? children : [];
}

function getPostUrl(data: JsonRecord): string | undefined {
  const url = getString(data, 'url_overridden_by_dest') || getString(data, 'url');
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

function countJsonCommentNodes(value: unknown): number {
  const record = asRecord(value);
  if (getString(record, 'kind') !== 't1') {
    return 0;
  }

  const data = asRecord(record?.data);
  if (!data) {
    return 0;
  }

  let childCount = 0;
  for (const child of getReplyChildren(data)) {
    childCount += countJsonCommentNodes(child);
  }
  return 1 + childCount;
}
