import { browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  
  main(ctx) {
    // Import capture module at runtime
    import('../content/capture.js').then(({ ContentCapture }) => {
      console.log('ContentCapture module loaded');
      // Listen for capture requests from background or popup
      browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        try {
          console.log('Content script received message:', message.type);
          
          if (message.type === 'CAPTURE_SELECTION') {
            console.log('Starting content capture...');
            const result = await ContentCapture.captureSelection();
            console.log('Capture completed, sending CAPTURE_COMPLETE message');
            console.log('Capture result summary:', {
              htmlLength: result.html.length,
              title: result.title,
              url: result.url,
              selectionHash: result.selectionHash
            });
            
            // Send captured content to background service worker
            console.log('Sending CAPTURE_COMPLETE message to background...');
            await browser.runtime.sendMessage({
              type: 'CAPTURE_COMPLETE',
              payload: result,
            });
            console.log('CAPTURE_COMPLETE message sent successfully');
            
            return true;
          } else if (message.type === 'COPY_TO_CLIPBOARD') {
            // Fallback clipboard copy for when navigator.clipboard fails
            console.log('Content script received COPY_TO_CLIPBOARD message');
            console.log('Content to copy (first 100 chars):', message.payload.content.substring(0, 100));
            console.log('Content length:', message.payload.content.length);
            
            try {
              // Try navigator.clipboard first
              console.log('Attempting navigator.clipboard.writeText from content script...');
              await navigator.clipboard.writeText(message.payload.content);
              console.log('navigator.clipboard.writeText succeeded in content script!');
              return true;
            } catch (clipError) {
              console.warn('Content script clipboard API failed, error:', clipError);
              console.log('Attempting execCommand fallback in content script...');
            }
            
            // Create a visible textarea to ensure focus and selection work
            const textArea = document.createElement('textarea');
            textArea.value = message.payload.content;
            
            // Make it visible but minimally intrusive
            textArea.style.position = 'fixed';
            textArea.style.top = '10px';
            textArea.style.left = '10px';
            textArea.style.width = '10px';
            textArea.style.height = '10px';
            textArea.style.opacity = '0.01'; // Almost invisible but still technically visible
            textArea.style.zIndex = '9999';
            
            document.body.appendChild(textArea);
            
            // Focus and select the text
            console.log('Focusing and selecting textarea...');
            textArea.focus();
            textArea.select();
            
            // Execute copy command
            console.log('Executing document.execCommand("copy")...');
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            console.log('Fallback clipboard copy success:', success);
            
            if (!success) {
              console.warn('execCommand returned false, trying one more approach...');
              
              // Try one more approach - create a user-visible prompt
              const promptDiv = document.createElement('div');
              promptDiv.style.position = 'fixed';
              promptDiv.style.top = '50%';
              promptDiv.style.left = '50%';
              promptDiv.style.transform = 'translate(-50%, -50%)';
              promptDiv.style.backgroundColor = 'white';
              promptDiv.style.padding = '20px';
              promptDiv.style.border = '1px solid black';
              promptDiv.style.zIndex = '10000';
              promptDiv.style.maxWidth = '80%';
              promptDiv.style.maxHeight = '80%';
              promptDiv.style.overflow = 'auto';
              promptDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
              
              const promptText = document.createElement('p');
              promptText.textContent = 'Automatic copy failed. Please press Ctrl+C/Cmd+C now to copy the selected text:';
              promptDiv.appendChild(promptText);
              
              const manualTextArea = document.createElement('textarea');
              manualTextArea.value = message.payload.content;
              manualTextArea.style.width = '100%';
              manualTextArea.style.height = '200px';
              manualTextArea.style.marginTop = '10px';
              promptDiv.appendChild(manualTextArea);
              
              const closeButton = document.createElement('button');
              closeButton.textContent = 'Close';
              closeButton.style.marginTop = '10px';
              closeButton.style.padding = '5px 10px';
              closeButton.addEventListener('click', () => document.body.removeChild(promptDiv));
              promptDiv.appendChild(closeButton);
              
              document.body.appendChild(promptDiv);
              
              manualTextArea.focus();
              manualTextArea.select();
              
              // Return true even though we're showing a manual prompt
              return true;
            }
            
            return true;
          }
        } catch (error) {
          console.error('Content script operation failed:', error);
          
          // Send error to background
          await browser.runtime.sendMessage({
            type: 'ERROR',
            payload: {
              message: error instanceof Error ? error.message : 'Content script operation failed',
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
