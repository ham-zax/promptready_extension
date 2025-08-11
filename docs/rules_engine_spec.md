
---

### **Rules Engine Specification**

As you agreed, here is the specification to guide the implementation of the `boilerplate-filters.ts` module. This will serve as the core of your extension's "secret sauce."

**1. Objective**
To create a deterministic, extensible, and performant engine for removing boilerplate and non-essential content from a captured DOM snapshot *before* it is processed by `Readability.js`.

**2. Location**
The entire logic for this engine will be contained within:
`content/clean/boilerplate-filters.ts`

**3. Input / Output**
-   **Input:** A raw DOM `Document` or `DocumentFragment` object captured from the page.
-   **Output:** A mutated `Document` or `DocumentFragment` with boilerplate elements removed.

**4. Proposed Rule Structure**
The engine will be driven by an array of `FilterRule` objects. This structure allows for easy addition, removal, and testing of individual rules.

```typescript
// in lib/types.ts
export enum FilterAction {
  REMOVE = 'remove', // Completely remove the element
  STRIP_ATTRIBUTES = 'strip_attributes', // Remove all attributes except a whitelist
  UNWRAP = 'unwrap', // Remove the element but keep its children
}

export interface FilterRule {
  /** A human-readable description of what the rule does. */
  description: string;
  /** The CSS selector to identify target elements. */
  selector: string;
  /** The action to perform on the matched elements. */
  action: FilterAction;
  /** Optional array of attributes to keep for STRIP_ATTRIBUTES action. */
  allowedAttributes?: string[];
}
```

**5. Rule Categories (Heuristics)**
The `boilerplate-filters.ts` module will export an array of `FilterRule` instances, categorized by purpose:

*   **General Boilerplate:** Rules to remove common site elements.
    *   `header`, `footer`, `nav`, `aside`, `[role="navigation"]`, `[class*="cookie"]`
*   **Social & Engagement:** Rules to remove social sharing widgets, comment sections, etc.
    *   `[class*="social"]`, `[class*="share"]`, `#comments`, `[id*="comments"]`
*   **Ads & Promotions:** Rules to remove common ad network patterns.
    *   `[class*="ad"]`, `[id*="adbox"]`, `iframe[src*="ads"]`
*   **Site-Specific Heuristics:** A section for rules targeting popular sites from the test matrix (MDN, GitHub, etc.) to handle their unique structures.
    *   *MDN:* `.main-menu`, `.mdn-header`
    *   *GitHub:* `[aria-label="Issues"]`, `.gh-header-actions`

**6. Implementation Notes**
-   The filter function should be a pure, stateless function that accepts a DOM node and the rules array.
-   It should iterate through the rules and apply them sequentially to the DOM node.
-   Each rule should be well-documented with a `description`.

**7. Example Rule**

```typescript
// in content/clean/boilerplate-filters.ts

import { FilterAction, FilterRule } from '~/lib/types';

export const BOILERPLATE_RULES: FilterRule[] = [
  {
    description: 'Remove common site navigation bars.',
    selector: 'nav, [role="navigation"]',
    action: FilterAction.REMOVE,
  },
  {
    description: 'Remove typical comment sections.',
    selector: '#comments, .comments, [id*="comments-container"]',
    action: FilterAction.REMOVE,
  },
  // ... more rules
];
```