# PROJECT_ANALYSIS_REPORT

## Overview
- Main programming language: JavaScript/TypeScript (user-provided).
- File tree summary (major directories):
  - [`assets/`](assets/)
  - [`components/`](components/)
  - [`content/`](content/)
  - [`core/`](core/)
  - [`docs/`](docs/)
  - [`entrypoints/`](entrypoints/)
  - [`functions/`](functions/)
  - [`lib/`](lib/)
  - [`pro/`](pro/)
  - [`public/`](public/)
  - [`redundant_docs/`](redundant_docs/)
  - [`sessions/`](sessions/)
  - [`tests/`](tests/)
  - [`types/`](types/)

## Dependencies
- Parsed successfully from [`package.json`](package.json:1).

### Runtime dependencies
- @joplin/turndown ^4.0.80 — [`package.json`](package.json:20)
- @joplin/turndown-plugin-gfm ^1.0.62 — [`package.json`](package.json:21)
- @mozilla/readability 0.4.1 — [`package.json`](package.json:22)
- @radix-ui/react-dialog ^1.1.14 — [`package.json`](package.json:23)
- @radix-ui/react-popover ^1.1.14 — [`package.json`](package.json:24)
- @radix-ui/react-select ^2.2.5 — [`package.json`](package.json:25)
- @radix-ui/react-slot ^1.2.3 — [`package.json`](package.json:26)
- @radix-ui/react-toggle ^1.1.10 — [`package.json`](package.json:27)
- @radix-ui/react-toggle-group ^1.1.11 — [`package.json`](package.json:28)
- @tailwindcss/vite ^4.1.11 — [`package.json`](package.json:29)
- cc-sessions ^0.3.6 — [`package.json`](package.json:30)
- class-variance-authority ^0.7.1 — [`package.json`](package.json:31)
- clsx ^2.1.1 — [`package.json`](package.json:32)
- cmdk ^1.1.1 — [`package.json`](package.json:33)
- dompurify ^3.2.6 — [`package.json`](package.json:34)
- lucide-react ^0.539.0 — [`package.json`](package.json:35)
- react ^19.1.0 — [`package.json`](package.json:36)
- react-dom ^19.1.0 — [`package.json`](package.json:37)
- tailwind-merge ^3.3.1 — [`package.json`](package.json:38)
- tailwindcss ^4.1.11 — [`package.json`](package.json:39)

### Dev dependencies
- @cloudflare/workers-types ^4.20250813.0 — [`package.json`](package.json:42)
- @testing-library/jest-dom ^6.7.0 — [`package.json`](package.json:43)
- @testing-library/react ^16.3.0 — [`package.json`](package.json:44)
- @types/jest ^30.0.0 — [`package.json`](package.json:45)
- @types/jsdom ^21.1.7 — [`package.json`](package.json:46)
- @types/react ^19.1.2 — [`package.json`](package.json:47)
- @types/react-dom ^19.1.3 — [`package.json`](package.json:48)
- @types/turndown ^5.0.5 — [`package.json`](package.json:49)
- @wxt-dev/module-react ^1.1.3 — [`package.json`](package.json:50)
- jsdom ^26.1.0 — [`package.json`](package.json:51)
- tw-animate-css ^1.3.6 — [`package.json`](package.json:52)
- typescript ^5.8.3 — [`package.json`](package.json:53)
- vitest ^3.2.4 — [`package.json`](package.json:54)
- wrangler ^4.30.0 — [`package.json`](package.json:55)
- wxt ^0.20.6 — [`package.json`](package.json:56)

## Files Recommended for Deletion
Note: No files have been deleted; this section recommends candidates for manual review only.

- Stale files: Skipped. File timestamps were not accessed due to workspace constraints; per instructions, the stale-files check is noted as skipped.
- Word files:
  - [`Credits.rtf`](node_modules/node-notifier/vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/Credits.rtf)
- Potentially redundant documentation (consider archiving rather than deleting):
  - [`redundant_docs/marketing.md`](redundant_docs/marketing.md)
  - [`redundant_docs/phase1-validation-plan.md`](redundant_docs/phase1-validation-plan.md)
  - [`redundant_docs/post-mvp-backend-architecture.md`](redundant_docs/post-mvp-backend-architecture.md)
  - [`redundant_docs/Post-MVP-Vision.md`](redundant_docs/Post-MVP-Vision.md)
  - [`redundant_docs/promptready_sprint1-kickoff_and_gtm-plan.md`](redundant_docs/promptready_sprint1-kickoff_and_gtm-plan.md)
  - [`redundant_docs/rules_engine_spec.md`](redundant_docs/rules_engine_spec.md)
  - [`redundant_docs/wxt_notes.md`](redundant_docs/wxt_notes.md)

- Unreferenced source files: A comprehensive import graph analysis was not executed in this pass. Recommended approach: build a dependency graph by scanning imports, requires, and exports statements, then diff against the list of source files (*.ts, *.tsx, *.js, *.jsx).

## Developer Notes
Collected notable occurrences of TODO/FIXME/NOTE/HACK/XXX. High volume exists under node_modules; the list below focuses on project-authored files (selected examples).

- [`sessions/protocols/task-startup/task-startup.md`](sessions/protocols/task-startup/task-startup.md:49) — Note: If resuming work on an existing branch
- [`sessions/protocols/task-completion/task-completion.md`](sessions/protocols/task-completion/task-completion.md:85) — NOTE: Do not commit until the task file is marked complete and moved to done/.
- [`sessions/hooks/sessions_enforce.js`](sessions/hooks/sessions_enforce.js:99) — Note: awk/sed are here but need special argument checking
- [`sessions/hooks/post_tool_use.js`](sessions/hooks/post_tool_use.js:114) — Todo completion
- [`sessions/protocols/context-compaction/context-compaction.md`](sessions/protocols/context-compaction/context-compaction.md:70) — Note on Context Refinement
- [`sessions/protocols/task-creation/task-creation.md`](sessions/protocols/task-creation/task-creation.md:196) — Important Note on Context

Additional findings in dependencies (examples, not actionable in project code):
- [`node_modules/wxt/dist/virtual/background-entrypoint.mjs`](node_modules/wxt/dist/virtual/background-entrypoint.mjs:150) — TODO: reloadContentScriptMv2