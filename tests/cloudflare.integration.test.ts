import { describe, test, expect } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';

// Cloudflare HTML fixture captured from a live error page (normalized in snapshot)
const cloudflareHtml = `
<div id="cf-error-details" class="p-0">
                <header class="mx-auto pt-10 lg:pt-6 lg:px-8 w-240 lg:w-full mb-15 antialiased">
                    <h1 class="inline-block md:block mr-2 md:mb-2 font-light text-60 md:text-3xl text-black-dark leading-tight">
                        <span data-translate="error">Error</span>
                        <span>1016</span>
                    </h1>
                    <span class="inline-block md:block heading-ray-id font-mono text-15 lg:text-sm lg:leading-relaxed">Ray ID: 96f7f214fadd85de •</span>
                    <span class="inline-block md:block heading-ray-id font-mono text-15 lg:text-sm lg:leading-relaxed">2025-08-15 10:18:02 UTC</span>
                    <h2 class="text-gray-600 leading-1.3 text-3xl lg:text-2xl font-light">
                        Origin DNS error
                    </h2>
                </header>
                
                
                <section class="w-240 lg:w-full mx-auto mb-8 lg:px-8">
                    <div id="what-happened-section" class="w-1/2 md:w-full">
                        <h2 class="text-3xl leading-tight font-normal mb-4 text-black-dark antialiased" data-translate="what_happened">
                            What happened?
                        </h2>
                        
                            <p>You've requested a page on a website (api-production.usecodex.com) that is on the <a href="https://www.cloudflare.com/5xx-error-landing/" target="_blank">Cloudflare</a> network. Cloudflare is currently unable to resolve your requested domain (api-production.usecodex.com).</p>
                        
                        
                        <p>
                            Please see
                            <a rel="noopener noreferrer" href="https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1016/" target="_blank">https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1016/</a>
                            for more details.
                        </p>
                        
                    </div>

                    
                    <div id="resolution-copy-section" class="w-1/2 mt-6 text-15 leading-normal">
                        <h2 class="text-3xl leading-tight font-normal mb-4 text-black-dark antialiased" data-translate="what_can_i_do">
                            What can I do?
                        </h2>
                        <p><strong>If you are a visitor of this website:</strong><br>Please try again in a few minutes.</p><p><strong>If you are the owner of this website:</strong><br>Check your DNS settings. If you are using a CNAME origin record, make sure it is valid and resolvable. <a rel="noopener noreferrer" href="https://support.cloudflare.com/hc/en-us/articles/234979888-Error-1016-Origin-DNS-error">Additional troubleshooting information here.</a></p>
                    </div>
                    
                </section>
                

                <div class="py-8 text-center" id="error-feedback">
    <div id="error-feedback-survey" class="footer-line-wrapper">
        Was this page helpful?
        <button class="border border-solid bg-white cf-button cursor-pointer ml-4 px-4 py-2 rounded" id="feedback-button-yes" type="button">
            Yes
        </button>
        <button class="border border-solid bg-white cf-button cursor-pointer ml-4 px-4 py-2 rounded" id="feedback-button-no" type="button">
            No
        </button>
    </div>
    <div class="feedback-success feedback-hidden" id="error-feedback-success" markdownload-hidden="true">
        Thank you for your feedback!
    </div>
</div> <div class="cf-error-footer cf-wrapper w-240 lg:w-full py-10 sm:py-4 sm:px-8 mx-auto text-center sm:text-left border-solid border-0 border-t border-gray-300">
    <p class="text-13">
      <span class="cf-footer-item sm:block sm:mb-1">Cloudflare Ray ID: <strong class="font-semibold">96f7f214fadd85de</strong></span>
      <span class="cf-footer-separator sm:hidden">•</span>
      <span id="cf-footer-item-ip" class="cf-footer-item sm:block sm:mb-1">
        Your IP:
        <button type="button" id="cf-footer-ip-reveal" class="cf-footer-ip-reveal-btn">Click to reveal</button>
        <span class="hidden" id="cf-footer-ip" markdownload-hidden="true">103.242.190.62</span>
        <span class="cf-footer-separator sm:hidden">•</span>
      </span>
      <span class="cf-footer-item sm:block sm:mb-1"><span>Performance &amp; security by</span> <a rel="noopener noreferrer" href="https://www.cloudflare.com/5xx-error-landing" id="brand_link" target="_blank">Cloudflare</a></span>
      
    </p>
    <script markdownload-hidden="true">(function(){function d(){var b=a.getElementById("cf-footer-item-ip"),c=a.getElementById("cf-footer-ip-reveal");b&&"classList"in b&&(b.classList.remove("hidden"),c.addEventListener("click",function(){c.classList.add("hidden");a.getElementById("cf-footer-ip").classList.remove("hidden")}))}var a=document;document.addEventListener&&a.addEventListener("DOMContentLoaded",d)})();</script>
  </div><!-- /.error-footer -->
            </div>
`;

describe('Cloudflare integration snapshot', () => {
  test('produces stable markdown snapshot', async () => {
        // Use the exact source URL reported by the user to match real outputs from the extension
        const result = await OfflineModeManager.processContent(
            cloudflareHtml,
            'https://api-production.usecodex.com/api/github/auth/vscode',
            ''
        );
    expect(result.success).toBe(true);

        // Normalize dynamic metadata and site-specific noise (timestamps, ray id, ip) before snapshot
        let normalized = result.markdown
            .replace(/^> Captured: .+$/m, '> Captured: <timestamp>')
            .replace(/^> Hash: .+$/m, '> Hash: <hash>');

        // Mask Cloudflare Ray ID hex strings
        normalized = normalized.replace(/Ray ID:\s*[0-9a-fA-F]+/g, 'Ray ID: <ray-id>');
        // Mask explicit timestamps like '2025-08-15 10:18:02 UTC'
        normalized = normalized.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/g, '<timestamp>');
        // Mask IP addresses
        normalized = normalized.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>');

    expect(normalized).toMatchSnapshot();
  });
});
