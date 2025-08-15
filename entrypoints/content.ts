import { browser } from 'wxt/browser';
import { ContentCapture } from '../content/capture.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',

  main(ctx) {
    console.log('PromptReady content script initializing...');
    console.log('ContentCapture module loaded');

    // ====================================================================================
    // Resilient Clipboard Module (Armored, All-Terrain Vehicle)
    // Centralized helper that attempts navigator.clipboard, falls back to execCommand,
    // and finally shows a manual UI prompt if all programmatic approaches fail.
    // ====================================================================================

    async function copyTextToClipboard(text: string): Promise<{ success: boolean; method?: string; error?: any }> {
  // Check permissions API for additional diagnostics
  const permState = await checkClipboardPermission();
  console.log('[BMAD_CLIPBOARD] clipboard-write permission state:', permState);
      // Tier 1: navigator.clipboard with best-effort focus
      try {
        try {
          window.focus();
          await new Promise((r) => setTimeout(r, 50));
        } catch (focusErr) {
          // focus may be blocked in some pages — that's fine; continue to attempt clipboard
          console.warn('[BMAD_CLIPBOARD] window.focus() failed or was blocked:', focusErr);
        }

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          console.log('[BMAD_CLIPBOARD] Success via navigator.clipboard');
          // Notify background/popup that copy succeeded
          await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success: true, method: 'navigator.clipboard' } }).catch(() => {});
          return { success: true, method: 'navigator.clipboard' };
        }
      } catch (err) {
        console.warn('[BMAD_CLIPBOARD] navigator.clipboard failed, proceeding to fallback.', err);
      }

      // Tier 2: execCommand fallback
      try {
        const ok = execCommandCopy(text);
        if (ok) {
          console.log('[BMAD_CLIPBOARD] Success via execCommand fallback');
          await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success: true, method: 'execCommand' } }).catch(() => {});
          return { success: true, method: 'execCommand' };
        }
      } catch (err) {
        console.warn('[BMAD_CLIPBOARD] execCommand fallback threw an error.', err);
      }

      // Tier 3: Manual UI fallback
      try {
        showManualCopyPrompt(text);
        await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success: false, method: 'manual-prompt' } }).catch(() => {});
        return { success: false, method: 'manual-prompt' };
      } catch (err) {
        console.error('[BMAD_CLIPBOARD] Manual prompt failed:', err);
        await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success: false, method: 'manual-prompt', error: String(err) } }).catch(() => {});
        return { success: false, error: err };
      }
    }

    function execCommandCopy(text: string): boolean {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // Place off-screen but keep selectable
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();

      let success = false;
      try {
        success = document.execCommand('copy');
      } catch (err) {
        console.warn('[BMAD_CLIPBOARD] execCommand threw an error.', err);
      }

      try {
        document.body.removeChild(textarea);
      } catch (e) {
        // ignore
      }

      return success;
    }

    function showManualCopyPrompt(text: string): void {
      // Simple non-blocking modal with a textarea the user can copy from
      try {
        const promptDiv = document.createElement('div');
        promptDiv.style.position = 'fixed';
        promptDiv.style.top = '50%';
        promptDiv.style.left = '50%';
        promptDiv.style.transform = 'translate(-50%, -50%)';
        promptDiv.style.backgroundColor = 'white';
        promptDiv.style.padding = '20px';
        promptDiv.style.border = '1px solid rgba(0,0,0,0.2)';
        promptDiv.style.zIndex = '100000';
        promptDiv.style.maxWidth = '90%';
        promptDiv.style.maxHeight = '80%';
        promptDiv.style.overflow = 'auto';
        promptDiv.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)';

        const promptText = document.createElement('p');
        promptText.textContent = 'Automatic copy failed. Please press Ctrl+C / Cmd+C to copy the text below:';
        promptDiv.appendChild(promptText);

        const manualTextArea = document.createElement('textarea');
        manualTextArea.value = text;
        manualTextArea.style.width = '100%';
        manualTextArea.style.height = '240px';
        manualTextArea.style.marginTop = '10px';
        promptDiv.appendChild(manualTextArea);

        const buttonsRow = document.createElement('div');
        buttonsRow.style.display = 'flex';
        buttonsRow.style.gap = '8px';
        buttonsRow.style.marginTop = '10px';

        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.style.padding = '6px 10px';
        copyButton.style.background = '#0366d6';
        copyButton.style.color = 'white';
        copyButton.style.border = 'none';
        copyButton.style.cursor = 'pointer';
        copyButton.addEventListener('click', async () => {
          try {
            copyButton.disabled = true;
            copyButton.textContent = 'Copying...';

            // First try navigator.clipboard under the user gesture
            try {
              if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(manualTextArea.value);
                console.log('[BMAD_CLIPBOARD] Manual Copy button: success via navigator.clipboard');
                await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success: true, method: 'manual-button:navigator.clipboard' } }).catch(() => {});
                try { document.body.removeChild(promptDiv); } catch(e) {}
                return;
              }
            } catch (err) {
              console.warn('[BMAD_CLIPBOARD] Manual Copy button navigator.clipboard failed, falling back to execCommand', err);
            }

            // Fallback to execCommand
            manualTextArea.select();
            const ok = execCommandCopy(manualTextArea.value);
            if (ok) {
              console.log('[BMAD_CLIPBOARD] Manual Copy button: success via execCommand');
              await browser.runtime.sendMessage({ type: 'COPY_COMPLETE', payload: { success: true, method: 'manual-button:execCommand' } }).catch(() => {});
              try { document.body.removeChild(promptDiv); } catch(e) {}
              return;
            }

            // If both failed, re-enable and show guidance
            copyButton.disabled = false;
            copyButton.textContent = 'Copy';
            alert('Automatic copy failed. Please press Ctrl+C / Cmd+C to copy the text.');
          } catch (err) {
            console.error('[BMAD_CLIPBOARD] Manual Copy button click failed:', err);
            try { document.body.removeChild(promptDiv); } catch(e) {}
          }
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '6px 10px';
        closeButton.addEventListener('click', () => {
          try { document.body.removeChild(promptDiv); } catch(e) {}
        });

        buttonsRow.appendChild(copyButton);
        buttonsRow.appendChild(closeButton);
        promptDiv.appendChild(buttonsRow);

        document.body.appendChild(promptDiv);
        manualTextArea.focus();
        manualTextArea.select();
      } catch (err) {
        console.error('[BMAD_CLIPBOARD] Failed to show manual copy prompt:', err);
        // As a last fallback, show alert
        try { alert('Automatic copy failed. Please copy the following text:\n\n' + text); } catch(e) {}
      }
    }

    async function checkClipboardPermission(): Promise<string> {
      try {
        if (!('permissions' in navigator)) return 'unknown';
        // PermissionName typing is strict; cast to any to allow clipboard-write
        // Some browsers may throw or return 'denied' / 'granted' / 'prompt'
        // Note: querying clipboard-write may be unsupported in some browsers
        // and will throw; we catch and return 'unknown'.
        // @ts-ignore
        const status = await navigator.permissions.query({ name: 'clipboard-write' as any });
        if (status && typeof status.state === 'string') return status.state;
        return 'unknown';
      } catch (err) {
        console.warn('[BMAD_CLIPBOARD] permissions.query for clipboard-write failed:', err);
        return 'unknown';
      }
    }

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

            // Use centralized resilient clipboard helper
            try {
              await copyTextToClipboard(exportMd);
              return true;
            } catch (err) {
              console.error('[BMAD_CLIPBOARD] copyTextToClipboard failed unexpectedly for processed markdown:', err);
              return true; // Don't surface runtime errors to the page
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

            // Use centralized resilient clipboard helper
            try {
                // If the sender requested the popup to close first (popup may steal focus),
                // wait a short moment to increase the chance the document is focused.
                if (message.payload && message.payload.waitForPopupClose) {
                  console.log('[BMAD_CLIPBOARD] waitForPopupClose requested; delaying briefly to allow popup to close');
                  await new Promise((r) => setTimeout(r, 250));
                }

                await copyTextToClipboard(message.payload.content);
              return true;
            } catch (err) {
              console.error('[BMAD_CLIPBOARD] copyTextToClipboard failed unexpectedly:', err);
              return true;
            }
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
