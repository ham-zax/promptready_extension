---
name: cleanup-project-analysis
branch: feature/cleanup-project-analysis
status: pending
created: 2025-11-01
submodules: []
---

# Project Cleanup and Context Analysis

## Problem/Goal
The PromptReady Chrome extension project has accumulated redundant files, outdated documentation, and temporary artifacts that need to be cleaned up. Need to analyze the project state and remove unnecessary files while preserving active development code.

## Success Criteria
- [ ] Remove redundant documentation and debug files
- [ ] Clean up backup files and temporary artifacts
- [ ] Resolve package manager lock file conflicts
- [ ] Preserve all active/important code and configuration
- [ ] Commit cleanup changes to finalize the project state

## Context Manifest

### Project Overview: PromptReady Chrome Extension

This is a **Manifest V3 Chrome extension** called "PromptReady" that provides intelligent content cleaning and structuring for web pages. The project is a sophisticated browser extension with both offline and AI-powered processing capabilities.

**What PromptReady Does:**
- **Core Function**: Captures selected web content and converts it to clean, structured Markdown format with citations
- **Two Processing Modes**: 
  - Offline Mode (free, local processing using rules-based engine)
  - AI Mode (metered trial → BYOK model using external AI APIs)
- **Monetization Strategy**: "Metered Freemium to BYOK" - users get free credits, then upgrade to Bring Your Own Key for unlimited usage

### Current State Analysis

**Development Status**: The project appears to be in active development with recent commits focusing on:
- BYOK (Bring Your Own Key) settings and model selection
- Monetization client refactoring 
- UI component improvements
- Backend credit service integration

**Architecture**: Modern WXT-based React extension with:
- **Entry Points**: Background service worker, content script, offscreen processor, popup UI
- **Tech Stack**: TypeScript, React, Tailwind CSS, WXT framework
- **Backend**: Serverless functions for credit tracking and AI proxy (Cloudflare Workers)
- **Storage**: Chrome storage API for local data persistence

### Files Categories for Cleanup

#### 1. Redundant Documentation (Safe to Remove)
**`redundant_docs/` folder** - Contains outdated planning documents:
- `Post-MVP-Vision.md` - Future planning beyond current scope
- `marketing.md` - Marketing strategies not needed for development
- `phase1-validation-plan.md` - Old validation plans
- `post-mvp-backend-architecture.md` - Superseded by current architecture
- `promptready_sprint1-kickoff_and_gtm-plan.md` - Old sprint planning
- `rules_engine_spec.md` - Outdated specifications
- `wxt_notes.md` - Development notes no longer relevant

#### 2. Development Debug Files (Safe to Remove)
**Temporary debugging documentation:**
- `DEBUG_STEPS.md` - Debug steps for clipboard issue (resolved)
- `CLIPBOARD_TEST.md` - Testing instructions for clipboard functionality
- `dont_read_unless_said_markdownloader/` folder - Historical analysis of MarkDownload extension, not related to current project

#### 3. Backup Files (Safe to Remove)
**`.claude/.backup-*` folders** - Automatic backups created by Claude Code:
- These are temporary backup directories that can be safely removed
- Git history provides sufficient version control

#### 4. Session Management System (Keep - Actively Used)
**`sessions/` folder** - Active task management system:
- This is an active "cc-sessions" installation for task management
- Contains protocols, agents, hooks, and current tasks
- Should be preserved as it's actively being used

#### 5. Package Management Files (Review)
**Multiple package managers detected:**
- `package-lock.json` (npm)
- `pnpm-lock.yaml` (pnpm)
- Should standardize on one package manager (pnpm preferred for performance)

### No "Word Project" Files Found
I searched extensively for files related to "word project" and found no Microsoft Word related files or word processing documentation that needs removal. The project is focused on web content to Markdown conversion.

### Active/Important Code to Preserve

**Core Application Files:**
- `entrypoints/` - All extension entry points (background, content, popup, offscreen)
- `core/` - Processing engines and business logic
- `lib/` - Shared utilities and types
- `components/` - UI components
- `functions/` - Backend serverless functions
- `pro/` - Monetization and BYOK clients

**Configuration:**
- `wxt.config.ts` - WXT extension configuration
- `tsconfig.json` - TypeScript configuration
- `vitest.config.ts` - Test configuration
- `wrangler.*.toml` - Cloudflare Workers configuration

**Current Documentation:**
- `docs/prd.md` - Master Product Requirements Document (active)
- `docs/Architecture-Unified.md.md` - Current architecture specification
- `CLAUDE.md` - Development guidelines
- `README.md` - Project overview (needs updating from template)

### Specific Cleanup Recommendations

**Immediate Cleanup (Safe):**
1. Remove entire `redundant_docs/` folder
2. Remove `DEBUG_STEPS.md` and `CLIPBOARD_TEST.md`
3. Remove `dont_read_unless_said_markdownloader/` folder
4. Remove `.claude/.backup-*` folders
5. Choose one package manager and remove the other lock file

**Review Before Removal:**
1. Update `README.md` from generic WXT template to describe PromptReady
2. Consider if any test files are outdated
3. Review git tracked files in `tests/__snapshots__/` for relevance

**Git Cleanup:**
- Many files show as modified (M) in git status - may need commit or reset
- New files (A) include sessions system and Claude agents - these appear intentional

### Development Environment Notes

**Build System:** Uses WXT framework for modern Chrome extension development
**Testing:** Vitest with React Testing Library
**Backend:** Cloudflare Workers for serverless functions
**Monetization:** Complex BYOK system with credit tracking and AI model selection

The project appears to be a production-bound Chrome extension with sophisticated features, active development, and a clear business model. The cleanup would primarily remove historical documentation and temporary files without affecting core functionality.

## User Notes
User has provided a cleanup script that handles the deletion process systematically with safety checks and user prompts for package manager selection.

## Work Log
- [2025-11-01] Created task for project cleanup and analysis