// Extended edge case tests for empty content, Unicode handling, and unusual text scenarios
// Builds upon basic edge cases with more comprehensive coverage

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OfflineModeManager } from '../core/offline-mode-manager';
import { safeParseHTML, extractSemanticContent } from '../lib/dom-utils';

describe('Extended Edge Cases - Empty Content Scenarios', () => {
  beforeEach(() => {
    OfflineModeManager.clearCache();
  });

  afterEach(() => {
    OfflineModeManager.clearCache();
  });

  it('should handle null HTML input', async () => {
    const nullHtml = null;
    const url = 'https://example.com';
    const title = 'Null HTML Test';

    // @ts-ignore - Testing null input
    const result = await OfflineModeManager.processContent(nullHtml as any, url, title);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle undefined HTML input', async () => {
    const undefinedHtml = undefined;
    const url = 'https://example.com';
    const title = 'Undefined HTML Test';

    // @ts-ignore - Testing undefined input
    const result = await OfflineModeManager.processContent(undefinedHtml as any, url, title);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle HTML with only whitespace', async () => {
    const whitespaceHtml = '   \t\n   \r\n   \t   ';
    const url = 'https://example.com';
    const title = 'Whitespace Only Test';

    const result = await OfflineModeManager.processContent(whitespaceHtml, url, title);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle HTML with only comments', async () => {
    const commentsOnly = `
      <!-- Comment 1 -->
      <!-- Comment 2 -->
      <!-- Comment 3 -->
      <!-- Multiline comment
           spanning multiple lines -->
      -->
    `;

    const result = await OfflineModeManager.processContent(commentsOnly, 'https://example.com', 'Comments Only Test');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle HTML with only script/style tags (empty)', async () => {
    const emptyScripts = `
      <script>
        // Empty script
        var x = 5;
      </script>
      <style>
        /* Empty styles */
        .empty { color: red; }
      </style>
      <script type="module">
        // Another empty module
        export {};
      </script>
    `;

    const result = await OfflineModeManager.processContent(emptyScripts, 'https://example.com', 'Empty Scripts Test');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle HTML with only empty structural tags', async () => {
    const emptyStructures = `
      <div></div>
      <span></span>
      <p></p>
      <section></section>
      <article></article>
      <header></header>
      <footer></footer>
      <nav></nav>
      <aside></aside>
      <main></main>
    `;

    const result = await OfflineModeManager.processContent(emptyStructures, 'https://example.com', 'Empty Structures Test');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No HTML content provided');
  });

  it('should handle HTML with only invisible elements', async () => {
    const invisibleElements = `
      <style>
        .hidden { display: none; }
        .invisible { visibility: hidden; }
        .zero-size { width: 0; height: 0; overflow: hidden; }
      </style>
      <div class="hidden">Hidden content</div>
      <div class="invisible">Invisible content</div>
      <div class="zero-size">Zero size content</div>
      <div style="display: none;">Style hidden</div>
      <div style="visibility: hidden;">Visibility hidden</div>
      <div style="width: 0; height: 0; overflow: hidden;">Zero dimensions</div>
      <input type="hidden" value="hidden input">
      <textarea style="display: none;">Hidden textarea</textarea>
    `;

    const result = await OfflineModeManager.processContent(invisibleElements, 'https://example.com', 'Invisible Elements Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Hidden content'); // Some content should be preserved
    expect(result.processingStats.qualityScore).toBeLessThan(80); // Lower quality due to invisibility
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('hidden'),
      expect.stringContaining('invisible')
    ]));
  });
});

describe('Extended Edge Cases - Advanced Unicode Scenarios', () => {
  it('should handle zero-width joiners and complex scripts', async () => {
    const complexUnicode = `
      <div>
        <h1>Unicode Test - Complex Scripts</h1>
        <p>Arabic: مرحبا بالعالم</p>
        <p>Hebrew: שָלום עולם</p>
        <p>Thai: สวัสดีครับ</p>
        <p>Devanagari: नमस्त दुनिया</p>
        <p>Bengali: স্বাকন</p>
        <p>Tamil: வணகம்</p>
        <p>Telugu: తెలుగు</p>
        <p>Korean: 안녕하세요</p>
        <p>Georgian: გამის მოყლ</p>
        <p>Armenian: բարեւ աշխաբ</p>
        <p>Amharic: ስውግንዝኛ</p>
        <p>Mongolian: Монгол улс</p>
        <p>Sinhala: සිංශුණ</p>
        <p>Myanmar: မြန်မား</p>
        <p>Khmer: ខ្ញុំដ់</p>
        <p>Lao: ສົງະນາຍ</p>
        <p>Tibetan: བཀུམས་ཅ</p>

        <p>Complex: English${'\u200D'}Arabic${'\u200C'}Chinese${'\u200D'}Mixed</p>

        <p>Zero-width joiners: ${'\u200B'}content${'\u200B'}with${'\u200B'}joiners${'\u200B'}</p>
        <p>Pop directional: ${'\u202D'}RTL${'\u202C'}text${'\u202D'}LTR${'\u202C'}</p>
      </div>
    `;

    const result = await OfflineModeManager.processContent(complexUnicode, 'https://example.com/complex-unicode', 'Complex Unicode Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('مرحبا بالعالم'); // Arabic preserved
    expect(result.markdown).toContain('שָלום עולם'); // Hebrew preserved
    expect(result.markdown).toContain('안녕하세요'); // Korean preserved
    expect(result.markdown).toContain('contentwithjoiners'); // Joiners preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(85); // High quality preservation
  });

  it('should handle mathematical and technical Unicode', async () => {
    const technicalUnicode = `
      <div>
        <h1>Mathematical and Technical Unicode</h1>
        <p>Mathematical Operators: ≠ ≤ ≥ ± × ÷ ∞ ∫ ∂ ∇ ∆ √ ∛ ∜</p>
        <p>Mathematical Symbols: ∑ ∏ ∀ ∃ ∅ ∈ ∉ ∪ ∩ ⊂ ⊃ ⊄ ⊆ ⊇ ⊈ ⊉</p>
        <p>Subscripts and Superscripts: x² x³ x⁴ xⁿ x₁ x₂ x₃ √∑∏</p>
        <p>Fractions and Special: ½ ¼ ¾ ⅓ ⅔ ⅛ ⅜ ⅝ ⅞ ⅟ ‰ ‱ ‰ ′ ″ ‴ ‵ ‶ ‷ ‸ ‹ › „ ‟ ‚ ‛ “ ‟ " „ ‘ ’ ‚ „ ‟</p>
        <p>Currency: $ € £ ¥ ₹ ₩ ₽ ₪ ₡ ₫ ₸ ₨ ₮</p>
        <p>Technical Symbols: ⌂ ⌃ ⌄ ⌅ ⌆ ⌇ ⌈ ⌉ ⌊ ⌋ ⌌ ⌍ ⌏ ⌐ ⌑ ⌒ ⌓ ⌔ ⌕ ⌖ ⌗ ⌘ ⌙ ⌚ ⌛ ⌜ ⌝ ⌞ ⌟</p>
        <p>Box Drawing Characters: ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╒ ╓ ╔ ╕ ╖ ╗ ╘ ╙ ╚ ╝ ╞ ╟ ╠ ╡ ╢ ╣ ╤ ╥ ╧ ╨ ╩</p>
        <p>Geometric Shapes: ▀ ▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▉ ▊ ▋ ▌ ▍ ▎ ▏ ▐ ░ ▒ ▓ ▔ ▕ ■ □ ▢ ▣ ▤ ▥ ▦ ▧ ▨ ▩ ▪ ▫ ▬ ▭ ▮ ▯ ▰ ▱ ▲ △ ▴ ▵ ▶ ▷ ▸ ▹ ▼ ▽ ◀ ◁ ◂ ◃ ◄ ◅ ◆ ◇ ◈ ◉ ◊ ○ ◌ ◍ ◎ ◐ ◑ ◒ ◓ ◔ ◕ ◖ ◗ ◘ ◙ ◚ ◛ ◜ ◝ ◞ ◟ ◠ ◡ ◢ ◣ ◤ ◥ ◦ ◧ ◨ ◩ ◪ ◫ ◬ ◭ ◮ ◯ ◰</p>
      </div>
    `;

    const result = await OfflineModeManager.processContent(technicalUnicode, 'https://example.com/technical-unicode', 'Technical Unicode Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('≠ ≤ ≥ ± × ÷'); // Math operators preserved
    expect(result.markdown).toContain('∑ ∏ ∀ ∃ ∅'); // Math symbols preserved
    expect(result.markdown).toContain('½ ¼ ¾ ⅓'); // Fractions preserved
    expect(result.markdown).toContain('$ € £ ¥ ₹'); // Currency preserved
    expect(result.markdown).toContain('─ │ ┌ ┐ └ ┘'); // Box drawing preserved
    expect(result.markdown).toContain('▀ ▁ ▂ ▃ ▄ ▅'); // Geometric shapes preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(80);
  });

  it('should handle emoji and modern Unicode', async () => {
    const modernUnicode = `
      <div>
        <h1>Emoji and Modern Unicode</h1>
        <p>Smileys: 😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😎 🤩 🤪 🥲 😭 🤫 🥱 😶 🤯 🤬 🤭</p>
        <p>Gestures: 👋 👌 👍 ✌ 👏 👐 🙏 👎 👊 👍 👇 👈 👉 👆 🤙 👏 🙌 👍 ✌ 🙏 👋 👎</p>
        <p>People: 👶 👶 👴 👵 👸 👹 👺 👻 👼 👽 🙋 🙋 💁 💂 💃 💄 💅 💆 💇 💇 💈 💉 💊 💋 🌍 🌎 🌏 🌐 🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌙 🌚 🌛 🌜 🌝 🌞 🌟 🌠 🌡</p>
        <p>Animals: 🐶 🐷 🐸 🐹 🐺 🐻 🐼 🐽 🙈 🐒 🐕 🦊 🦝 🐾 🐿 🦃 🦄 🦅 🦆 🦇 🦌 🦍 🦎 🦏 🦐 🦑 🦒 🦓 🦔 🦕 🦖 🦗 🦘 🦙 🦚 🦛 🦁 🐯 🦒 🐇 🦁 🦷 🐅</p>
        <p>Food: 🍇 🍈 🍉 🍊 🍋 🍌 🍍 🍎 🍏 🍐 🍑 🍒 🍓 🍔 🍕 🍖 🍗 🍘 🍙 🍚 🍛 🍜 🍝 🍞 🍟 🍠 🍡 🥟 🥐 🥑 🥒 🥓 🥔 🥕 🥖 🥗 🥘 🥙 🥚 🥛 🥜 🥝 🥞 🥟 🥠 🥡 🥢 🥣 🥤 🥥 🥦 🥧 🥨 🥩 🥪 🥫 🥬</p>
        <p>Activities: ⚽ 🎯 🥅 🎨 🎬 🏃 🏄 🏅 🏆 🏇 🎰 🎱 🎲 🎵 🎶 🎷 🎸 🎹 🎼 🏁 🎂 🎃 🎄 🎅 🎆 🎇 🎰 🎱</p>
        <p>Travel: 🚀 🚁 🚂 🚃 🚄 🚅 🚆 🚇 🚈 🚉 🚊 🚋 🚍 🚎 🚏 🚐 🚑 🚒 🚓 🚔 🚕 🚖 🚗 🚘 🚙 🚚 🚛 🚜 🚝 🚞 🚟 🚠 🚡 🛸 🛹 🛺 🛻 🛼 🛽 🚁 🚂 🚃 🚄 🚅 🚆 🚇 🚈 🚉 🚊 🚋 🚍 🚎 🚏 🚐 🚑 🚒 🚓 🚔 🚕 🚖 🚗 🚘 🚙</p>
        <p>Objects: ⌰ ⌱ ⌲ ⌳ ⌴ ⌷ ⌸ ⌹ ⌺ ⌻ ⌼ ⌽ ⌾ ⌿ ⍀ ⍁ ⍂ ⍃ ⍄ ⍅ ⍆ ⍇ ⍈ ⍉ ⍊ ⍋ ⍌ ⍍ ⍎ ⍏ ⍐ ⍑ ⍒ ⍓ ⍔ ⍕ ⍖ ⍗ ⍘ ⍙ ⍚ ⍛ ⍜ ⍝</p>

        <p>Flags: 🏁 🇦🇶 🇦🇸 🇪🇸 🇷🇴 🇷🇺 🇹🇼 🇻🇳 🇨🇳 🇺🇸 🇺🇳 🇦🇫 🇪🇫 🇫🇷 🇹🇷 🇸🇹 🇲🇸 🇱🇹 🇴🇧 🇶🇦 🇳🇬 🇦🇮 🇴🇴 🇧🇪 🇩🇪 🇩🇬 🇪🇧 🇫🇴 🇳🇬</p>
      </div>
    `;

    const result = await OfflineModeManager.processContent(modernUnicode, 'https://example.com/modern-unicode', 'Modern Unicode Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('😀 😃 😄 😁'); // Emoji preserved
    expect(result.markdown).toContain('🐶 🐷 🐸 🐹'); // Animal emoji preserved
    expect(result.markdown).toContain('🍇 🍈 🍉 🍊'); // Food emoji preserved
    expect(result.markdown).toContain('⚽ 🎯 🥅'); // Activities preserved
    expect(result.markdown).toContain('🚀 🚁 🚂 🚃'); // Travel emoji preserved
    expect(result.markdown).toContain('🏁 🇦🇶 🇦🇸'); // Flag emoji preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(90);
  });

  it('should handle text direction and BIDI scenarios', async () => {
    const bidiHtml = `
      <div>
        <h1>Bidirectional Text Handling</h1>

        <p dir="rtl">مرحبا بالعالم (RTL Arabic)</p>
        <p dir="ltr">Hello World (LTR English)</p>

        <div dir="auto">
          <p>English text followed by العربية العربية (auto-detected)</p>
        </div>

        <p dir="rtl">
          <span dir="ltr">English LTR inside RTL container</span>
          العربية العربية
        </p>

        <p dir="ltr">
          English text
          <span dir="rtl">العربية العربية RTL inside LTR</span>
          more English
        </p>

        <p>Mixed: Hello مرحبا 世界 こんにちは (Mixed LTR and RTL)</p>

        <p>Numbers in RTL: 1234567890 (مرحبا) (العربية)</p>

        <p>Numbers with directional markers: 123\u200E456\u200F789 (arabic text)</p>

        <p>Parentheses in RTL: (English) (العربية) [English] [العربية] {English} {العربية}</p>

        <ul dir="rtl">
          <li>العربية القائمة الأولى</li>
          <li>العربية القائمة الثانية</li>
          <li dir="ltr">English list item in RTL list</li>
        </ul>

        <blockquote dir="rtl">
          <p>الاقتباس RTL: "مرحبا بالعالم"</p>
          <p dir="ltr">English LTR: "Hello World"</p>
        </blockquote>
      </div>
    `;

    const result = await OfflineModeManager.processContent(bidiHtml, 'https://example.com/bidi', 'Bidirectional Text Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('مرحبا بالعالم'); // Arabic content preserved
    expect(result.markdown).toContain('Hello World'); // English content preserved
    expect(result.markdown).toContain('العربية القائمة الأولى'); // RTL list items preserved
    expect(result.markdown).toContain('English list item in RTL list'); // Mixed direction preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(85);
  });

  it('should handle complex combining and modifier sequences', async () => {
    const combiningHtml = `
      <div>
        <h1>Combining Characters and Modifiers</h1>

        <p>Combining Diacritics: e\u0301 (e acute), c\u0301 (c circumflex), n\u0303 (n tilde), a\u0308\u0301 (a ring and acute)</p>

        <p>Variation Selectors: e\u0301 (e acute), a\u0302 (e double acute), a\u0308 (e caron), a\u0327 (e horn), a\u031B (e macron below)</p>

        <p>Enclosing Marks: q\u20DD (q in circle), p\u20DE (p in circle), o\u20EE (o in circle), x\u20DD (x in circle)</p>

        <p>Special combining: a\u0361\u0301\u0302\u0303\u0304 (a with multiple combining marks), x\u035F\u0308\u0344 (x with combining long stroke overlay)</p>

        <p>Regional Indicator Symbols: U+1F1F4 (Regional Indicator Symbol Letter U), U+1F1F5-200D-1F1F7 (regional indicator emojis)</p>

        <p>Tag Characters: U+E0001 (Language Tag), U+E007F (Cancel Tag)</p>

        <p>Suspension and Insertion Marks: \u0301 (combining grave accent), \u034F (combining inverted bridge below), \u0350 (combining left half ring below)</p>

        <p>Special Format Controls: \u202A (Left-to-Right Embedding), \u202B (Right-to-Left Embedding), \u202C (Pop Directional Formatting), \u202D (Left-to-Right Override)</p>

        <p>CJK Compatibility Ideographs: 㐄 㐅 㐆 㐇 㐈 㐉 㐊 㐋 㐌 㐍 㐎 㐏 㐐 㐑 㐒 㐓 㐔 㐕 㐖 㐗 㐘 㐙 㐚 㐛 㐜 㐞 㐟 㐠 㐡 㐢 㐣 㐤 㐥 㐦 㐧 㐨 㐩 㐪 㐫 㐬 㐭 㐮 㐯 㐰 㐱 㐲 㐳 㐴 㐵 㐶 㐷 㐸 㐹 㐺 㐻 㐼 㐽 㐾 㐿</p>

        <p>Complex CJK: 齉 龖 龦 龧 龨 龩 龪 龫 龬 龭 龮 龯 龰 龱 龲 龳 龴 龵 龶 龷 龸 龹 龺 龻 龼 龽 龾 龿 鿀 鿁 鿂 鿃 鿄 鿅 鿆 鿇 鿈 鿉 鿊 鿋 鿌 鿍 鿎 鿏 鿐 鿑 鿒 鿓 鿔 鿕 鿖 鿗 鿘 鿙 鿚 鿛 鿜 鿝 鿞 鿟 鿠 鿡 鿢 鿣 鿤 鿥 鿦 鿧 鿨 鿩 鿪</p>
      </div>
    `;

    const result = await OfflineModeManager.processContent(combiningHtml, 'https://example.com/combining', 'Combining Characters Test');

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('e\u0301'); // Combining marks preserved
    expect(result.markdown).toContain('q\u20DD'); // Enclosing marks preserved
    expect(result.markdown).toContain('U+E0001'); // Tag characters preserved
    expect(result.markdown).toContain('齉 龖 龦'); // CJK compatibility ideographs preserved
    expect(result.markdown).toContain('\u202A'); // Directional formatting preserved
    expect(result.processingStats.qualityScore).toBeGreaterThan(75);
  });
});

describe('Extended Edge Cases - Performance and Memory Edge Cases', () => {
  it('should handle extremely long single words', async () => {
    const extremelyLongWord = 'supercalifragilisticexpialidocious'.repeat(100); // Very long word repeated
    const longWordHtml = `<p>${extremelyLongWord}</p>`;
    const url = 'https://example.com/long-words';
    const title = 'Extremely Long Words Test';

    const startTime = performance.now();
    const result = await OfflineModeManager.processContent(longWordHtml, url, title);
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(result.markdown).toContain(extremelyLongWord); // Long word preserved
    expect(endTime - startTime).toBeLessThan(5000); // Should process efficiently
    expect(result.processingStats.qualityScore).toBeGreaterThan(60);
  });

  it('should handle massive repeated patterns', async () => {
    const repeatedPattern = 'Test pattern '.repeat(10000); // 10,000 repetitions
    const patternHtml = `<p>${repeatedPattern}</p>`;
    const url = 'https://example.com/repeated-patterns';
    const title = 'Massive Repeated Patterns Test';

    const startTime = performance.now();
    const result = await OfflineModeManager.processContent(patternHtml, url, title);
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Test pattern'); // Pattern preserved
    expect(endTime - startTime).toBeLessThan(3000); // Should handle efficiently
    expect(result.processingStats.qualityScore).toBeGreaterThan(70);
  });

  it('should handle deeply nested mixed content types', async () => {
    const deeplyNested = `
      <div id="outer-div">
        <article class="deep-article">
          <section>
            <header>
              <h1>
                <span>Main Title</span>
                <small>Subtitle</small>
              </h1>
            </header>
            <main>
              <div>
                <table>
                  <thead>
                    <tr>
                      <th colspan="3">Complex Table Header</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <ul>
                          <li>List Item 1
                            <ol>
                              <li>Nested Ordered Item 1
                                <blockquote>
                                  <p>Quote within nested structure</p>
                                  <pre><code>Code block within quote</code></pre>
                                </blockquote>
                              </li>
                              <li>Nested Ordered Item 2</li>
                            </ol>
                          </li>
                          <li>List Item 2</li>
                          <li>List Item 3</li>
                        </ul>
                      </td>
                      <td>
                        <div>
                          <img src="test.jpg" alt="Test Image">
                          <figcaption>Image caption</figcaption>
                        </div>
                      </td>
                      <td>
                        <details>
                          <summary>Expandable Content</summary>
                          <p>Hidden content that appears when expanded</p>
                          <form>
                            <input type="text" placeholder="Input within details">
                            <button type="submit">Submit</button>
                          </form>
                        </details>
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </main>
              <aside>
                <nav>
                  <ul>
                    <li><a href="#section1">Link 1</a></li>
                    <li><a href="#section2">Link 2</a></li>
                  </ul>
                </nav>
                <div>
                  <blockquote>
                    <p>Side content quote</p>
                    <footer>Quote footer</footer>
                  </blockquote>
                </div>
              </aside>
              <footer>
                <p>Footer content</p>
              </footer>
            </section>
        </article>
      </div>
    `;

    const startTime = performance.now();
    const result = await OfflineModeManager.processContent(deeplyNested, 'https://example.com/deeply-nested', 'Deeply Nested Test');
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(result.markdown).toContain('Main Title'); // Should extract main content
    expect(result.markdown).toContain('List Item 1'); // Should extract list items
    expect(result.markdown).toContain('Quote within nested structure'); // Should extract quotes
    expect(result.markdown).toContain('Code block within quote'); // Should preserve code blocks
    expect(result.markdown).toContain('Expandable Content'); // Should preserve details/summary
    expect(endTime - startTime).toBeLessThan(4000); // Should process within reasonable time
    expect(result.processingStats.qualityScore).toBeGreaterThan(75); // Should maintain high quality
  });

  it('should handle malformed Unicode sequences gracefully', async () => {
    const malformedUnicode = `
      <div>
        <p>Invalid UTF-8 sequences: \xFF\xFE, \xC0\x80, \xE0\x80\x80</p>
        <p>High surrogate without low surrogate: \uD800</p>
        <p>Low surrogate without high surrogate: \uDC00</p>
        <p>Invalid combining: a\u0300\u0301\u0302\u0303\u0304\u0305</p>
        <p>Overlong normalizations: e\u0301\u030C\u0340\u0341\u0303 (e with macron and acute overlong)</p>
        <p>Invalid Unicode width: \uFFF9\uFFFD\uFFFE\uFFFF</p>
        <p>Control characters in content: \x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0B\x0C\x0D\x0E\x0F\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1A</p>
      </div>
    `;

    const result = await OfflineModeManager.processContent(malformedUnicode, 'https://example.com/malformed-unicode', 'Malformed Unicode Test');

    expect(result.success).toBe(true);
    expect(result.warnings).toContainEqual(expect.arrayContaining([
      expect.stringContaining('Unicode'),
      expect.stringContaining('invalid'),
      expect.stringContaining('control character')
    ]));
    expect(result.processingStats.qualityScore).toBeGreaterThan(40); // Should preserve most content
  });
});