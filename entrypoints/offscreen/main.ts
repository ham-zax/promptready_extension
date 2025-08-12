import { Readability } from '@mozilla/readability';

console.log('Offscreen document loaded');

browser.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  try {
    if (message?.type === 'OFFSCREEN_COPY') {
      console.log('[offscreen] Received OFFSCREEN_COPY');
      const content: string = message?.payload?.content ?? '';
      try {
        await navigator.clipboard.writeText(content);
        console.log('[offscreen] navigator.clipboard.writeText success');
        sendResponse?.({ success: true, method: 'clipboard' });
      } catch (e) {
        // navigator.clipboard often requires a user activation which offscreen docs don't have.
        // Demote to debug to avoid alarming logs; we'll fall back to execCommand below.
        console.debug('[offscreen] clipboard API not available; using execCommand fallback');
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('[offscreen] execCommand result:', success);
        sendResponse?.({ success, method: 'execCommand' });
      }
      return true; // keep channel open for async response
    }

    if (message?.type === 'OFFSCREEN_PROCESS') {
      const { html, url, title, selectionHash, mode, renderer } = message.payload ?? {};
      if (!html || !url || !title || !selectionHash) return true;

      // Helpers
      const absolutizeUrls = (root: HTMLElement, baseUrl: string) => {
        // Links
        root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (!href) return;
          try { a.href = new URL(href, baseUrl).href; } catch {}
        });
        // Images
        root.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
          const src = img.getAttribute('src');
          if (!src) return;
          try { img.src = new URL(src, baseUrl).href; } catch {}
        });
      };
      const ensureBase = (doc: Document, baseUrl: string) => {
        if (!doc.querySelector('base')) {
          const base = doc.createElement('base');
          base.href = baseUrl;
          doc.head?.prepend(base);
        }
      };

      // Parse once
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      ensureBase(parsed, url);
      absolutizeUrls(parsed.body as HTMLElement, url);

      // Decide processing pipeline
      let cleanedHtml: string;
      const readabilityEnabled = (renderer === 'turndown' || renderer === 'structurer') && (message.payload?.useReadability !== false);
      if (readabilityEnabled) {
        // Readability-first for content
        try {
          const reader = new Readability(parsed.cloneNode(true) as Document);
          const article = reader.parse();
          cleanedHtml = article?.content || (parsed.body?.innerHTML || html);
        } catch {
          // Fallback to our cleaner if Readability throws
          const { ContentCleaner } = await import('../../core/cleaner.js');
          const cr = await ContentCleaner.clean(html, url, {
            mode,
            preserveCodeBlocks: true,
            preserveTables: true,
            removeHiddenElements: true,
          });
          cleanedHtml = cr.cleanedHtml;
        }
      } else {
        // Use our conservative cleaner
        const { ContentCleaner } = await import('../../core/cleaner.js');
        const cr = await ContentCleaner.clean(html, url, {
          mode,
          preserveCodeBlocks: true,
          preserveTables: true,
          removeHiddenElements: true,
        });
        cleanedHtml = cr.cleanedHtml;
      }

      const useTurndown = renderer === 'turndown';
      const metadata = {
        title,
        url,
        capturedAt: new Date().toISOString(),
        selectionHash,
      };
      let fullMarkdown: string | undefined;
      let exportData: any;

      try {
        if (useTurndown) {
          const { renderWithTurndown } = await import('../../lib/markdown/markdownload-adapter.js');
          const td = await renderWithTurndown(cleanedHtml, { title, url });
          fullMarkdown = td.markdown;
          const { ContentStructurer } = await import('../../core/structurer.js');
          exportData = await ContentStructurer.structure(cleanedHtml, metadata, {
            mode,
            preserveCodeLanguages: true,
            maxHeadingLevel: 3,
            includeTableHeaders: true,
          });
        }
      } catch (err) {
        console.warn('[offscreen] Turndown path failed, falling back to structurer:', err);
      }

      if (!fullMarkdown || !exportData) {
        const { ContentStructurer } = await import('../../core/structurer.js');
        exportData = await ContentStructurer.structure(cleanedHtml, metadata, {
          mode,
          preserveCodeLanguages: true,
          maxHeadingLevel: 3,
          includeTableHeaders: true,
        });
        const exportMd = ContentStructurer.blocksToMarkdown(exportData.blocks);
        const citationFooter = ContentStructurer.generateCitationFooter(metadata);
        fullMarkdown = `${exportMd}\n\n${citationFooter}`;
      }

      // Fallback for pages like Google SERPs where Readability/Structurer may yield empty content
      try {
        const blocksCount = Array.isArray(exportData?.blocks) ? exportData.blocks.length : 0;
        const fromSelection = Boolean(message.payload?.isSelection);
        if (!fromSelection && (blocksCount === 0 || (fullMarkdown?.trim().length || 0) < 50)) {
          const items: Array<{ title: string; href: string }> = [];
          parsed.querySelectorAll('#search a h3').forEach((h3) => {
            const a = h3.closest('a');
            if (a && a instanceof HTMLAnchorElement && h3.textContent?.trim()) {
              items.push({ title: h3.textContent.trim(), href: a.href });
            }
          });
          if (items.length > 0) {
            const listMd = items.map((it) => `- [${it.title}](${it.href})`).join('\n');
            fullMarkdown = `# Search Results\n\n${listMd}\n\n` + `**Source:** ${url}`;
            exportData = {
              version: '1.0',
              metadata,
              blocks: items.map((it) => ({ type: 'paragraph', text: `- [${it.title}](${it.href})` })),
            };
          }
        }
      } catch (fallbackErr) {
        console.warn('[offscreen] SERP fallback failed:', fallbackErr);
      }

      await browser.runtime.sendMessage({
        type: 'OFFSCREEN_PROCESSED',
        payload: {
          exportMd: fullMarkdown,
          exportJson: exportData,
          metadata,
        },
      });

      return true;
    }
  } catch (err) {
    console.error('Offscreen error:', err);
    try {
      await browser.runtime.sendMessage({
        type: 'ERROR',
        payload: { message: (err as any)?.message || 'Offscreen processing failed' },
      });
    } catch {}
  }
});

browser.runtime.sendMessage({ type: 'OFFSCREEN_READY' });


