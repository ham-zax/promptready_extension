// Scoring engine for offscreen content selection
// Encapsulates heuristics used to pick the best candidate element on technical pages.

export class ScoringEngine {
  private static POSITIVE_KEYWORDS = /(content|article|body|main|story|product|detail|overview|spec|datasheet)/i;
  private static NEGATIVE_KEYWORDS = /(nav|menu|header|footer|sidebar|breadcrumb|social|comment|ad|promo|widget|popup)/i;

  /**
   * Score an element by combining multiple heuristics.
   * Returns a numeric score where higher values indicate higher likelihood of main content.
   */
  public static scoreNode(el: HTMLElement): number {
    if (!el) return 0;
    try {
      const style = window.getComputedStyle(el);
      if (style && (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0)) {
        return 0;
      }

      const text = (el.textContent || '').trim();
      if (text.length < 50) return 0; // ignore tiny elements

      let score = 0;
      score += this.scoreByClassName(el);
      score += this.scoreByElementType(el);
      score -= this.calculateLinkDensityPenalty(el);
      score += this.scoreByContentCharacteristics(el);

      return score;
    } catch (e) {
      // Defensive: if anything goes wrong scoring this node, treat it as non-content
      console.warn('[ScoringEngine] scoreNode error:', e);
      return 0;
    }
  }

  /**
   * Scores based on class and ID names using positive/negative keyword weighting.
   */
  private static scoreByClassName(el: HTMLElement): number {
    const classAndId = `${el.className || ''} ${el.id || ''}`.toLowerCase();
    let score = 0;
    if (this.NEGATIVE_KEYWORDS.test(classAndId)) score -= 50;
    if (this.POSITIVE_KEYWORDS.test(classAndId)) score += 25;
    return score;
  }

  /**
   * Scores based on the HTML tag name (structure signal).
   */
  private static scoreByElementType(el: HTMLElement): number {
    switch (el.tagName.toLowerCase()) {
      case 'main':
      case 'article':
        return 20;
      case 'section':
        return 10;
      case 'div':
        return 5; // common container, slightly positive
      case 'nav':
      case 'header':
      case 'footer':
      case 'aside':
        return -50;
      default:
        return 0;
    }
  }

  /**
   * Calculates a penalty based on link-text ratio to total text.
   * High link density reduces confidence that this is main content.
   */
  private static calculateLinkDensityPenalty(el: HTMLElement): number {
    const text = (el.textContent || '').trim();
    const textLength = Math.max(1, text.length);
    const links = Array.from(el.querySelectorAll('a'));
    const linkTextLength = links.reduce((acc, a) => acc + ((a.textContent || '').length), 0);
    const density = linkTextLength / textLength;

    if (density > 0.3) {
      // Penalty scaled by textLength to penalize large link-heavy containers
      return Math.pow(density, 2) * textLength * 0.5;
    }
    return 0;
  }

  /**
   * Rewards elements for having characteristics typical of main content.
   */
  private static scoreByContentCharacteristics(el: HTMLElement): number {
    let score = 0;
    const text = (el.textContent || '').trim();
    const textLength = text.length;

    // Reward amount of text
    score += Math.floor(textLength / 100);

    // Strong signal: presence of data tables (technical pages often have tables)
    if (el.querySelector('table')) score += 30;

    // Reward paragraphs
    score += el.querySelectorAll('p').length * 2;

    // Reward headings (but cap)
    const headingCount = el.querySelectorAll('h1, h2, h3').length;
    score += Math.min(10, headingCount * 3);

    return score;
  }

  /**
   * Takes a candidate element and removes its direct children that are likely boilerplate.
   * Returns a pruned clone of the original element.
   */
  public static pruneNode(el: HTMLElement): HTMLElement {
    try {
      const workingCopy = el.cloneNode(true) as HTMLElement;
  // Tuned threshold: be more aggressive removing low-scoring children.
  // Setting to 0 removes any child with a non-positive score.
  const NEGATIVE_SCORE_THRESHOLD = 0; // Changed from -5

      for (const child of Array.from(workingCopy.children)) {
        const childEl = child as HTMLElement;
        const score = this.scoreNode(childEl);

        console.log(`[BMAD_PRUNE_DBG] Pruning Candidate: <${childEl.tagName.toLowerCase()} id="${childEl.id}" class="${childEl.className}"> -- Score: ${score}`);

        if (score < NEGATIVE_SCORE_THRESHOLD) {
          console.warn(`[BMAD_PRUNE] Pruning node with score ${score}:`, childEl);
          childEl.remove();
        }
      }

      return workingCopy;
    } catch (e) {
      console.warn('[ScoringEngine] pruneNode failed, returning original clone:', e);
      return el.cloneNode(true) as HTMLElement;
    }
  }
}