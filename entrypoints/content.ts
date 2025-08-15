import { browser } from 'wxt/browser';
import { ContentCapture } from '../content/capture.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',

  main(ctx) {
    console.log('PromptReady content script initializing...');
    console.log('ContentCapture module loaded');

    // Immediately send a ready signal to background
    browser.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(err => {
      console.log('Failed to send ready signal (background may not be ready yet):', err);
    });

    // Attach the message listener exactly once. Content scripts can be injected/reloaded
    // in ways that would otherwise register duplicate listeners. Use a global guard
    // so repeated initializations don't add multiple handlers.
    if (!(globalThis as any).__PROMPTREADY_MESSAGE_LISTENER_ATTACHED) {
      (globalThis as any).__PROMPTREADY_MESSAGE_LISTENER_ATTACHED = true;
      console.log('Attaching single runtime.onMessage listener for PromptReady content script');

      // Listen for capture requests from background or popup
      browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        try {
          console.log('Content script received message:', message.type);

          // Health check ping
          if (message.type === 'PING') {
            sendResponse({ ok: true });
            return true;
          }

          // Offscreen/background forwarded processing result for this tab - perform clipboard write here
          if (message.type === 'PROCESSING_COMPLETE_FOR_TAB') {
            console.log('Content script received PROCESSING_COMPLETE_FOR_TAB');
            const exportMd = message.payload?.exportMd || '';
            console.log('[BMAD_TRACE] Content script received for clipboard (PROCESSING_COMPLETE_FOR_TAB):', (exportMd || '').substring(0, 100));
            if (!exportMd) {
              console.warn('No exportMd provided in PROCESSING_COMPLETE_FOR_TAB');
              return true;
            }

            try {
              console.log('Attempting navigator.clipboard.writeText from content script for processed markdown...');
              try {
                // Ensure the document has focus before calling clipboard APIs. This
                // helps avoid NotAllowedError when the user interacted with the
                // extension popup which moved focus away from the page.
                // A short timeout gives the browser time to apply the focus change.
                // If focus() is not permitted in this context it will throw; swallow errors.
                window.focus();
                await new Promise((r) => setTimeout(r, 50));
              } catch (focusErr) {
                console.warn('window.focus() failed or was blocked:', focusErr);
              }

              await navigator.clipboard.writeText(exportMd);
              console.log('navigator.clipboard.writeText succeeded in content script for processed markdown');
              // Optionally notify background/popup that copy succeeded
              await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success: true, method: 'content-script' } }).catch(() => {});
              return true;
            } catch (clipErr) {
              console.warn('navigator.clipboard.writeText failed for processed markdown, falling back to execCommand:', clipErr);
            }

            // ExecCommand fallback (visible minimal textarea to ensure selection works)
            try {
              const textArea = document.createElement('textarea');
              textArea.value = exportMd;
              textArea.style.position = 'fixed';
              textArea.style.top = '10px';
              textArea.style.left = '10px';
              textArea.style.width = '10px';
              textArea.style.height = '10px';
              textArea.style.opacity = '0.01';
              textArea.style.zIndex = '9999';
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              const success = document.execCommand('copy');
              document.body.removeChild(textArea);
              console.log('Fallback clipboard copy success for processed markdown:', success);
              await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success, method: 'content-script-fallback' } }).catch(() => {});
              return true;
            } catch (fallbackErr) {
              console.error('Fallback clipboard copy also failed for processed markdown:', fallbackErr);
              // As last resort, show manual prompt to user
              try {
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
                promptText.textContent = 'Automatic copy failed. Please press Ctrl+C/Cmd+C now to copy the processed text:';
                promptDiv.appendChild(promptText);

                const manualTextArea = document.createElement('textarea');
                manualTextArea.value = exportMd;
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
                return true;
              } catch (uiErr) {
                console.error('Failed to show manual copy prompt:', uiErr);
                return true;
              }
            }
          }

          if (message.type === 'CAPTURE_SELECTION' || message.type === 'CAPTURE_SELECTION_ONLY') {
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
            // BMAD diagnostic trace
            console.log('[BMAD_TRACE] Content script received for clipboard (COPY_TO_CLIPBOARD):', (message.payload?.content || '').substring(0, 100));
            console.log('[BMAD_TRACE] Content length:', (message.payload?.content || '').length);

            try {
              // Try navigator.clipboard first
              console.log('Attempting navigator.clipboard.writeText from content script...');
              try {
                window.focus();
                await new Promise((r) => setTimeout(r, 50));
              } catch (focusErr) {
                console.warn('window.focus() failed or was blocked:', focusErr);
              }

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

          // Send error to background (best-effort)
          await browser.runtime.sendMessage({
            type: 'ERROR',
            payload: {
              message: error instanceof Error ? error.message : 'Content script operation failed',
            },
          }).catch(() => {});

          return true;
        }
      });
    } else {
      console.log('PromptReady content script message listener already attached; skipping re-attach');
    }

    console.log('PromptReady content script loaded');
  },
});
