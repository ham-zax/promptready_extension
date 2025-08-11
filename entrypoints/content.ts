import { browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  
  main(ctx) {
    // Import capture module at runtime
    import('../content/capture.js').then(({ ContentCapture }) => {
      // Listen for capture requests from background or popup
      browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        try {
          if (message.type === 'CAPTURE_SELECTION') {
            const result = await ContentCapture.captureSelection();
            
            // Send captured content to background service worker
            await browser.runtime.sendMessage({
              type: 'CAPTURE_COMPLETE',
              payload: result,
            });
            
            return true;
          }
        } catch (error) {
          console.error('Content script capture failed:', error);
          
          // Send error to background
          await browser.runtime.sendMessage({
            type: 'ERROR',
            payload: {
              message: error.message || 'Content capture failed',
            },
          });
        }
      });
      
      console.log('PromptReady content script loaded');
    }).catch(error => {
      console.error('Failed to load content capture module:', error);
    });
  },
});
