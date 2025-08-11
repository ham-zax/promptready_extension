// Turndown adapter using custom rules (links, mathjax, fenced code, images)
// Adapts the shared ideas from MarkDownload into a small, typed helper.

// Prefer the Joplin fork for better table handling
import TurndownService from '@joplin/turndown';

export interface TurndownOptions {
  title?: string;
  url?: string;
  // math id -> { tex, inline }
  math?: Record<string, { tex: string; inline: boolean }>; 
  downloadImages?: boolean;
  imageList?: Record<string, string>;
  linkStyle?: 'stripLinks' | 'inline' | 'referenced';
  imageStyle?: 'normal' | 'noImage' | 'obsidian' | 'obsidian-embed';
  imageRefStyle?: 'inline' | 'referenced';
  codeBlockStyle?: 'fenced' | 'indented';
  fence?: string;
}

export async function renderWithTurndown(html: string, meta: { title?: string; url?: string }) {
  const container = document.createElement('template');
  container.innerHTML = html;

  const turndown: any = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    fence: '```',
  } as any);
  // Load GFM plugin lazily to avoid bundler init order issues
  try {
    // @ts-ignore
    const mod = await import('@joplin/turndown-plugin-gfm');
    const gfm = (mod as any).gfm;
    if (gfm) turndown.use(gfm);
  } catch (e) {
    console.warn('[turndown] Failed to load GFM plugin, continuing without it:', e);
  }

  // Custom rules
  addLinksRule(turndown);
  addMathjaxRule(turndown, {} as any); // placeholder math map
  addFencedCodeRule(turndown);
  addPreAsCodeRule(turndown);
  addImagesRule(turndown);

  let markdown = turndown.turndown(container.innerHTML);
  markdown = stripNonPrintingChars(markdown);
  return { markdown };
}

function addLinksRule(tds: any) {
  tds.addRule('links', {
    filter: (node: any, options: any) => node.nodeName === 'A' && options.linkStyle === 'stripLinks',
    replacement: (content: string) => content,
  });
}

function addMathjaxRule(tds: any, options: { math?: Record<string, { tex: string; inline: boolean }> }) {
  tds.addRule('mathjax', {
    filter(node: any, _opts: any) {
      return options.math && Object.prototype.hasOwnProperty.call(options.math, node.id);
    },
    replacement(_content: string, node: any) {
      const math = options.math![node.id];
      let tex = math.tex.trim().replaceAll('\xa0', '');
      if (math.inline) {
        tex = tex.replaceAll('\n', ' ');
        return `$${tex}$`;
      }
      return `$$\n${tex}\n$$`;
    },
  });
}

function addFencedCodeRule(tds: any) {
  tds.addRule('fencedCodeBlock', {
    filter(node: any, options: any) {
      return (
        options.codeBlockStyle === 'fenced' &&
        node.nodeName === 'PRE' &&
        (!node.firstChild || node.firstChild.nodeName !== 'CODE') &&
        !node.querySelector('img')
      );
    },
    replacement(_content: string, node: any, options: any) {
      return convertToFencedCodeBlock(node.firstChild, options);
    },
  });
}

function addPreAsCodeRule(tds: any) {
  tds.addRule('pre', {
    filter: (node: any) => node.nodeName === 'PRE' && (!node.firstChild || node.firstChild.nodeName !== 'CODE'),
    replacement: (_content: string, node: any, options: any) => convertToFencedCodeBlock(node, options),
  });
}

function addImagesRule(tds: any) {
  tds.addRule('images', {
    filter: (node: any) => node.nodeName === 'IMG' && node.getAttribute('src'),
    replacement: function (_content: string, node: any, options: any) {
      let src = node.getAttribute('src');
      if (options.downloadImages) src = options.imageList?.[node.getAttribute('src')] ?? src;
      if (options.imageStyle === 'noImage') return '';
      if (String(options.imageStyle || '').startsWith('obsidian')) return `![[${src}]]`;
      const alt = cleanAttr(node.getAttribute('alt'));
      const title = cleanAttr(node.getAttribute('title'));
      const titlePart = title ? ` "${title}"` : '';
      if (options.imageRefStyle === 'referenced') {
        // @ts-ignore
        const id = this.references.length + 1;
        // @ts-ignore
        this.references.push('[fig' + id + ']: ' + src + titlePart);
        return '![' + alt + '][fig' + id + ']';
      }
      return src ? '![' + alt + '](' + src + titlePart + ')' : '';
    },
    references: [] as string[],
    append: function () {
      // @ts-ignore
      if (!this.references.length) return '';
      // @ts-ignore
      const refs = this.references.join('\n');
      // @ts-ignore
      this.references = [];
      return `\n\n${refs}\n\n`;
    },
  } as any);
}

function convertToFencedCodeBlock(node: any, options: any) {
  node.innerHTML = String(node.innerHTML || '').replaceAll('<br-keep></br-keep>', '<br>');
  const langMatch = node.id?.match(/code-lang-(.+)/);
  const language = langMatch?.[1] || '';
  const code = node.innerText || '';
  const fenceChar = (options.fence || '```').charAt(0);
  let fenceSize = 3;
  const re = new RegExp('^' + fenceChar + '{3,}', 'gm');
  let match;
  while ((match = re.exec(code))) {
    if (match[0].length >= fenceSize) fenceSize = match[0].length + 1;
  }
  const fence = fenceChar.repeat(fenceSize);
  return `\n\n${fence}${language}\n${code.replace(/\n$/, '')}\n${fence}\n\n`;
}

function cleanAttr(a?: string | null) {
  return a ? a.replace(/(\n+\s*)+/g, '\n') : '';
}

function stripNonPrintingChars(s: string) {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g, '');
}


