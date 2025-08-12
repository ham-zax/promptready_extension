# UI Flows & Visual Design — PromptReady Simplified (AI-First)

**Author:** BMad UX Analysis  
**Version:** 1.0 (AI-First Monetization)  
**Date:** 2025-01-12

## 1. Design Philosophy

**"Stupidly Simple"** - Two-click maximum for any user goal:
1. **Offline Mode:** Open extension → Content auto-copied → Done
2. **AI Mode:** Open extension → Toggle AI → Content processed & copied → Done

**Visual Hierarchy:**
- **Mode Toggle** is the primary UI element (drives monetization)
- **Action Button** is secondary (execution)
- **Settings** are tertiary (progressive disclosure)

## 2. Core UI Flow

### 2.1 Primary Flow (Offline Mode - Free)
```
User selects text on webpage
↓
Presses Ctrl+Shift+L OR clicks extension icon
↓
Popup opens showing:
┌─────────────────────────────────────┐
│ 🅿️ PromptReady              [⚙️]    │
├─────────────────────────────────────┤
│                                     │
│     ⚫ Offline    ⚪ AI Mode         │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │     ✨ Clean & Copy             │ │
│  │        (Processing...)          │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ✅ Copied to clipboard!            │
│                                     │
└─────────────────────────────────────┘
```

### 2.2 Premium Flow (AI Mode - Pro)
```
User selects text on webpage
↓
Presses Ctrl+Shift+L OR clicks extension icon
↓
Popup opens, user toggles to AI Mode:
┌─────────────────────────────────────┐
│ 🅿️ PromptReady              [⚙️]    │
├─────────────────────────────────────┤
│                                     │
│     ⚪ Offline    ⚫ AI Mode         │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │   🤖 AI Enhanced Processing     │ │
│  │      (Analyzing content...)     │ │
│  └─────────────────────────────────┘ │
│                                     │
│  ✅ Enhanced content copied!        │
│                                     │
│  💡 Upgrade to Pro for unlimited    │
│     AI processing                   │
└─────────────────────────────────────┘
```

## 3. Detailed UI Components

### 3.1 Header Section
```
┌─────────────────────────────────────┐
│ 🅿️ PromptReady              [⚙️]    │
├─────────────────────────────────────┤
```
- **Logo + Title:** Brand identity, always visible
- **Settings Gear:** Expands inline settings (progressive disclosure)
- **No back button needed** - single interface

### 3.2 Mode Toggle (Primary Element)
```
│     ⚫ Offline    ⚪ AI Mode         │
```
**Visual Design:**
- Large, prominent toggle buttons
- **Offline:** Free, instant, local processing
- **AI Mode:** Premium, enhanced, requires Pro
- **Active state:** Filled circle, bold text
- **Inactive state:** Empty circle, muted text

**Behavior:**
- Clicking AI Mode when not Pro → Shows upgrade prompt
- Clicking AI Mode when Pro but no API key → Shows API key setup
- Toggle state persists between sessions

### 3.3 Action Button (Secondary Element)
```
│  ┌─────────────────────────────────┐ │
│  │     ✨ Clean & Copy             │ │
│  │        (Processing...)          │ │
│  └─────────────────────────────────┘ │
```

**States:**
- **Ready:** "✨ Clean & Copy" (Offline) / "🤖 AI Enhanced Processing" (AI Mode)
- **Processing:** Shows spinner + status text
- **Complete:** Brief success state, then returns to ready

**Auto-execution:** Button triggers automatically when popup opens if text is selected

### 3.4 Status/Feedback Section
```
│  ✅ Copied to clipboard!            │
│                                     │
│  💡 Upgrade to Pro for unlimited    │
│     AI processing                   │
```

**Feedback Types:**
- **Success:** Green checkmark + confirmation
- **Error:** Red warning + helpful message
- **Upsell:** Blue info icon + Pro benefits
- **Progress:** Processing indicators

### 3.5 Inline Settings (Progressive Disclosure)
Clicking the gear icon expands settings within the popup:

```
┌─────────────────────────────────────┐
│ 🅿️ PromptReady              [✕]    │
├─────────────────────────────────────┤
│                                     │
│ ⚙️ Settings                         │
│                                     │
│ 🤖 AI Configuration                 │
│ ┌─────────────────────────────────┐ │
│ │ API Key: [••••••••••••••] [👁️] │ │
│ │ Model: [gpt-4o-mini      ▼]    │ │
│ │ Provider: OpenRouter            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 🎨 Appearance                       │
│ Theme: [System ▼]                   │
│                                     │
│ 🔒 Privacy                          │
│ ☐ Enable usage analytics           │
│                                     │
│ 💎 Pro Status: Free                │
│ [Upgrade to Pro]                    │
│                                     │
└─────────────────────────────────────┘
```

## 4. User Journey Mapping

### 4.1 First-Time User (Free)
1. **Discovery:** User installs extension
2. **First Use:** Selects text, presses hotkey
3. **Success:** Content instantly copied, positive feedback
4. **Exploration:** Notices AI Mode toggle, clicks it
5. **Upsell:** Sees Pro upgrade prompt with benefits
6. **Decision Point:** Continues with free or upgrades

### 4.2 Pro User Setup
1. **Upgrade:** User decides to try AI Mode
2. **Configuration:** Clicks settings gear, enters API key
3. **First AI Use:** Toggles to AI Mode, processes content
4. **Value Realization:** Sees enhanced output quality
5. **Habit Formation:** Prefers AI Mode for important content

### 4.3 Power User Workflow
1. **Muscle Memory:** Hotkey → Auto-process → Auto-copy
2. **Mode Switching:** Quick toggle based on content type
3. **Minimal Friction:** No navigation, no complex settings

## 5. Visual Design Specifications

### 5.1 Color Palette
- **Primary Blue:** #2563eb (mode toggle active, action buttons)
- **Success Green:** #16a34a (success states, checkmarks)
- **Warning Orange:** #ea580c (upsell, attention)
- **Error Red:** #dc2626 (error states)
- **Neutral Gray:** #6b7280 (inactive states, secondary text)
- **Background:** #ffffff (light) / #1f2937 (dark)

### 5.2 Typography
- **Headings:** 16px, semibold, system font
- **Body:** 14px, regular, system font
- **Captions:** 12px, regular, muted color
- **Buttons:** 14px, medium, system font

### 5.3 Spacing & Layout
- **Popup Width:** 384px (24rem)
- **Popup Height:** Auto, min 240px
- **Padding:** 16px standard, 12px compact
- **Border Radius:** 8px for cards, 6px for buttons
- **Shadows:** Subtle elevation for depth

## 6. Responsive Behavior

### 6.1 Content Adaptation
- **Long Status Messages:** Wrap gracefully, maintain readability
- **API Key Display:** Truncate with ellipsis, show/hide toggle
- **Model Names:** Truncate long names, show full name on hover

### 6.2 State Management
- **Loading States:** Disable interactions, show progress
- **Error Recovery:** Clear error states on retry
- **Settings Persistence:** Remember toggle states, API keys

## 7. Accessibility Features

### 7.1 Keyboard Navigation
- **Tab Order:** Mode toggle → Action button → Settings gear
- **Enter/Space:** Activate focused elements
- **Escape:** Close settings panel, return to main view

### 7.2 Screen Reader Support
- **ARIA Labels:** All interactive elements labeled
- **Live Regions:** Status updates announced
- **Role Attributes:** Proper semantic markup

### 7.3 Visual Accessibility
- **High Contrast:** Meets WCAG AA standards
- **Focus Indicators:** Clear visual focus rings
- **Color Independence:** Information not conveyed by color alone

## 8. Implementation Notes

### 8.1 Component Structure
```
PopupApp
├── Header (logo, title, settings toggle)
├── ModeToggle (offline/AI selection)
├── ActionButton (main CTA with states)
├── StatusSection (feedback, upsell)
└── SettingsPanel (progressive disclosure)
```

### 8.2 State Management
- **Global State:** Mode, processing status, settings
- **Local State:** UI interactions, temporary feedback
- **Persistence:** Settings saved to chrome.storage.local

### 8.3 Performance Considerations
- **Instant Feedback:** UI updates immediately on interaction
- **Background Processing:** Heavy work in service worker
- **Optimistic Updates:** Assume success, handle errors gracefully

---

**Key Design Principles:**
1. **Mode Toggle First** - Primary monetization driver
2. **Auto-execution** - Minimal user friction
3. **Progressive Disclosure** - Advanced features hidden until needed
4. **Clear Value Prop** - AI Mode benefits obvious and compelling
