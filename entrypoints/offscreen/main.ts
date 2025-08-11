console.log('Offscreen document loaded');

browser.runtime.onMessage.addListener(async (message) => {
  try {
    if (message?.type === 'OFFSCREEN_COPY') {
      const content: string = message?.payload?.content ?? '';
      try {
        await navigator.clipboard.writeText(content);
      } catch (e) {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      return true;
    }

    if (message?.type === 'OFFSCREEN_PROCESS') {
      const { html, url, title, selectionHash, mode } = message.payload ?? {};
      if (!html || !url || !title || !selectionHash) return true;

      // Dynamic import of processing modules inside offscreen context
      const { ContentCleaner } = await import('../../core/cleaner.js');
      const { ContentStructurer } = await import('../../core/structurer.js');

      const cleanResult = await ContentCleaner.clean(html, url, {
        mode,
        preserveCodeBlocks: true,
        preserveTables: true,
        removeHiddenElements: true,
      });

      const metadata = {
        title,
        url,
        capturedAt: new Date().toISOString(),
        selectionHash,
      };

      const exportData = await ContentStructurer.structure(cleanResult.cleanedHtml, metadata, {
        mode,
        preserveCodeLanguages: mode === 'code_docs',
        maxHeadingLevel: 3,
        includeTableHeaders: true,
      });

      const exportMd = ContentStructurer.blocksToMarkdown(exportData.blocks);
      const citationFooter = ContentStructurer.generateCitationFooter(metadata);
      const fullMarkdown = `${exportMd}\n\n${citationFooter}`;

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
  }
});

browser.runtime.sendMessage({ type: 'OFFSCREEN_READY' });


