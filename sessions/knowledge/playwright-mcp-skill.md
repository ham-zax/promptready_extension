---
name: playwright-mcp
description: Use when you need to automate browser interactions, test web applications, or perform browser-based testing with Playwright MCP for full browser access
---

# Playwright MCP Skill Guide

## Overview
Playwright MCP provides browser automation capabilities with full access to Chrome, Firefox, and other browsers. Perfect for testing web applications, automating browser interactions, and performing end-to-end testing.

## Installation Check
Playwright MCP should be installed via:
```bash
npx @playwright/mcp@latest
```

## Running Playwright MCP

### 1. Start Playwright MCP Server
```bash
# Basic usage
npx @playwright/mcp@latest

# With Chrome browser
npx @playwright/mcp@latest --browser chrome

# With specific viewport size
npx @playwright/mcp@latest --viewport-size 1280x720

# Headless mode for background operations
npx @playwright/mcp@latest --headless

# Allow specific permissions (clipboard, geolocation, etc.)
npx @playwright/mcp@latest --grant-permissions clipboard-read clipboard-write

# Save session and traces for debugging
npx @playwright/mcp@latest --save-session --save-trace
```

### 2. Common Browser Operations
Playwright MCP provides browser automation tools that include:
- Page navigation and interaction
- Element selection and manipulation
- Screenshot capture and video recording
- Network request/response monitoring
- Console log inspection
- Cookie and storage management

### 3. Key Browser Testing Capabilities
- **Extension Testing**: Test Chrome extensions by navigating to chrome://extensions/
- **Content Capture**: Select and manipulate DOM elements
- **Form Interaction**: Fill forms, click buttons, submit data
- **Network Monitoring**: Inspect API calls and responses
- **Screenshot Testing**: Capture visual states and compare
- **User Flow Testing**: Complete end-to-end user journeys

## Use Cases for PromptReady Extension Testing

### Extension Installation & Loading
```bash
# Navigate to Chrome extensions page
npx @playwright/mcp@latest --browser chrome --grant-permissions extensions
# Then navigate to: chrome://extensions/
# Enable Developer Mode
# Load unpacked extension from .output/chrome-mv3/
```

### Service Worker Testing
```bash
# Check service worker status in DevTools
# Navigate to: chrome://inspect/#service-workers
# Find PromptReady service worker
# Inspect for errors and console output
```

### Content Processing Testing
```bash
# Test content selection on a webpage
# Navigate to test page
# Select text content
# Trigger extension popup
# Verify processing results
```

### API Testing (Backend Integration)
```bash
# Monitor network requests when using AI mode
# Check API calls to backend services
# Verify request/response formats
# Test error scenarios
```

## Common Playwright MCP Commands

### Browser Navigation
- Navigate to URLs
- Wait for page loads
- Handle page reloads and navigation

### Element Interaction
- Click buttons and links
- Fill form fields
- Select dropdown options
- Scroll and zoom

### Content Selection
- Select text content
- Verify DOM elements
- Check CSS selectors
- Inspect element attributes

### Screenshot & Visual Testing
- Capture full page screenshots
- Take element screenshots
- Compare visual states
- Record video sessions

### Network Monitoring
- Intercept HTTP requests
- Inspect API calls
- Modify request headers
- Mock network responses

## Error Handling

- Check browser console for errors
- Inspect service worker logs
- Verify extension permissions
- Test offline scenarios
- Validate API responses

## Best Practices

1. **Always clean up** browser sessions after testing
2. **Use specific selectors** for reliable element targeting
3. **Wait for elements** before interacting with them
4. **Handle dynamic content** with proper waits
5. **Test multiple browsers** if cross-browser compatibility is needed
6. **Monitor performance** during automated testing

## Testing Workflow for PromptReady

1. **Extension Setup**: Install and enable extension
2. **Permission Check**: Verify all required permissions are granted
3. **Content Testing**: Test selection and processing on various pages
4. **AI Mode Testing**: Test credit system and backend integration
5. **BYOK Testing**: Test API key configuration and direct AI calls
6. **Error Scenarios**: Test network failures, invalid inputs, etc.
7. **User Journey**: Complete end-to-end workflow testing

---

**When to use this skill**: Invoke when you need to automate browser interactions, test the PromptReady extension, perform web application testing, or require full browser access for validation tasks.