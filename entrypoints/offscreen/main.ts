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
        console.warn('[offscreen] clipboard API failed, falling back to execCommand', e);
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


