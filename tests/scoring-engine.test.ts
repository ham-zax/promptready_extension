import { describe, it, expect } from 'vitest';
import { ScoringEngine } from '../core/scoring/scoring-engine';
import { JSDOM } from 'jsdom';

describe('ScoringEngine', () => {
  describe('pruneNode', () => {
    it('should recursively remove low-scoring nested elements', () => {
      const html = `
        <div id="root" score="100">
          <div id="child1" score="50">
            <p>Some text</p>
            <div id="nested-bad" score="-10">Negative content</div>
          </div>
          <div id="child2" score="-20">
            <p>More negative content</p>
          </div>
          <div id="child3" score="30">
            <div id="nested-good" score="20">Good content</div>
          </div>
        </div>
      `;
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const root = doc.getElementById('root')!;

      // Mock scoreNode to return scores from attributes
      ScoringEngine.scoreNode = (el: HTMLElement) => {
        return parseInt(el.getAttribute('score') || '0', 10);
      };

      const pruned = ScoringEngine.pruneNode(root);

      expect(pruned.querySelector('#nested-bad')).toBeNull();
      expect(pruned.querySelector('#child2')).toBeNull();
      expect(pruned.querySelector('#nested-good')).not.toBeNull();
      expect(pruned.querySelector('#child1')).not.toBeNull();
      expect(pruned.querySelector('#child3')).not.toBeNull();
    });
  });
});
