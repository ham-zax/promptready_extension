# Developer Mode Instructions

## Developer Mode Status: **PERMANENTLY ENABLED**

Developer mode is now **enabled by default** in the storage settings. No activation required!

## What You'll See Immediately

When you build and load the extension, the popup will show:
- Yellow "DEV" badge next to the title
- "Developer Mode Active" text instead of credits
- "AI (DEV)" label instead of "AI (Trial)" or "AI (BYOK)"
- **Both offline and AI mode capture buttons will work**

## Manual Toggle (Optional)

If you want to toggle developer mode manually:
1. Open the extension popup
2. Type `devmode` (the letters will appear as you type them when the popup has focus)
3. You should see "🔓 Developer mode activated/deactivated" in the console

## Developer Mode Features

- **Unrestricted AI Mode**: No credit checks or limitations
- **Enhanced Export Options**: 
  - Raw MD
  - Raw JSON  
  - Code Block (escaped for markdown)
  - HTML source
- **Developer Info Section**: Shows pipeline used, character count, and processing stats
- **Bypass All Monetization**: Complete access to AI mode without API keys

## Disable Developer Mode

Type `devmode` again to toggle it off. You'll see "🔒 Developer mode deactivated" in the console.

## Technical Implementation

- Uses hidden keyboard sequence activation
- Modifies feature flags in storage
- Bypasses credit checks in popup controller
- Preserves production monetization flow
- Only affects local installation