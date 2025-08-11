import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

// Unlisted script entrypoint for MV3 offscreen clipboard handling
export default defineUnlistedScript(() => {
  browser.runtime.onMessage.addListener(async (message) => {
    try {
      if (message?.type === 'OFFSCREEN_COPY') {
        const content: string = message.payload?.content ?? '';
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
    } catch (err) {
      console.error('Offscreen copy failed:', err);
    }
  });

  // Notify background that offscreen is ready
  browser.runtime.sendMessage({ type: 'OFFSCREEN_READY' });
});


