
### **Rules Engine Specification v2.0**

*   **Status:** FINAL (v2.0)
*   **Purpose:** To provide a definitive source of truth for the architecture and responsibilities of the `boilerplate-filters.ts` module.

**1. Objective**
To provide a versatile, two-stage cleaning engine that intelligently removes boilerplate from a captured DOM snapshot. The engine is a core component of a hybrid pipeline, capable of performing both a conservative "safe" pass for all content and a subsequent "aggressive" pass for content that bypasses the standard Readability.js extractor.

**2. Location**
The entire logic for this engine is contained within:
`core/filters/boilerplate-filters.ts`

**3. Input / Output**
-   **Input:** An `HTMLElement` (typically `doc.body`) and an optional array of `FilterRule` objects.
-   **Output:** A mutated `HTMLElement` with boilerplate elements removed or unwrapped.

**4. Core Concepts & Architecture**

The engine's architecture is defined by three core concepts:

*   **Two-Stage Cleaning:** The engine's primary strategy is to apply filters in two distinct passes.
    1.  **Safe Pass (Default):** A comprehensive set of rules that favors the `UNWRAP` action for broad structural elements (`nav`, `footer`). This is designed to remove boilerplate containers without destroying potentially valuable content nested inside them. This pass runs on *all* pages.
    2.  **Aggressive Pass (Conditional):** A smaller, more targeted set of rules that uses the `REMOVE` action. This pass is only executed within the "Intelligent Bypass Pipeline" after the Safe Pass is complete, allowing it to aggressively delete the now-orphaned text and links left behind by the `UNWRAP` action.

*   **Intelligent Preservation:** The engine is not a "dumb" filter. Before applying any rule, it uses a powerful heuristic function (`shouldPreserveElement`) to check if the target element contains signals of being important technical content. This function uses a combination of whitelist selectors, data attributes, and contextual heading analysis to protect valuable content from being filtered.

*   **Pipeline Decision Making:** The engine exposes a wrapper function (`shouldBypassReadability`) that uses the same preservation heuristic to provide a high-level `true/false` signal to the main pipeline orchestrator, allowing it to decide whether to use the standard Readability path or the advanced bypass path.

**5. Rule Structure**
The engine is driven by an array of `FilterRule` objects. The `FilterAction` enum has been simplified to reflect the final, implemented strategy.

```typescript
// in lib/types.ts
export enum FilterAction {
  REMOVE = 'remove', // Completely remove the element and all its children.
  UNWRAP = 'unwrap', // Remove the element but keep its children.
}

export interface FilterRule {
  description: string;
  selector: string;
  action: FilterAction;
}
```

**6. Exported Rule Sets**
The module exports two distinct rule sets, corresponding to the two cleaning stages:

*   **`BOILERPLATE_FILTER_RULES` (Safe Pass):** The main, comprehensive list of rules. It targets a wide range of boilerplate but uses `UNWRAP` for structural tags.
    ```typescript
    // Example from BOILERPLATE_FILTER_RULES
    {
      description: 'Remove page footers',
      selector: 'footer, [role="contentinfo"], .footer',
      action: FilterAction.UNWRAP, // <-- Safe default
    }
    ```
*   **`AGGRESSIVE_FILTER_RULES` (Aggressive Pass):** The smaller, specialized list for the bypass pipeline. It uses `REMOVE`.
    ```typescript
    // Example from AGGRESSIVE_FILTER_RULES
    {
      description: 'Aggressively remove common site footers.',
      selector: 'footer, [role="contentinfo"], .footer',
      action: FilterAction.REMOVE, // <-- Aggressive action
    }
    ```

**7. Key Responsibilities & Public API**

*   **`applyRules(element, [rules])`:** The main workhorse function. It iterates through a given set of rules (or the default `BOILERPLATE_FILTER_RULES`) and applies them to the DOM element, respecting the preservation heuristic.
*   **`shouldPreserveElement(element)`:** The core intelligence of the module. Returns `true` if an element should be protected from filtering.
*   **`shouldBypassReadability(element)`:** The primary decision-making function for the external pipeline orchestrator.
