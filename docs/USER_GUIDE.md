# PromptReady Extension - User Guide

## Getting Started

### Installation

#### From Chrome Web Store
1. **Open Chrome Web Store**: Navigate to [Chrome Web Store](https://chrome.google.com/webstore)
2. **Search PromptReady**: Find "PromptReady - AI-Powered Content Cleaner"
3. **Install Extension**: Click "Add to Chrome" and confirm installation
4. **Pin Extension**: Click the puzzle icon in toolbar, then pin PromptReady for easy access

#### Development Installation
1. **Clone Repository**: `git clone https://github.com/ham-zax/promptready_extension.git`
2. **Install Dependencies**: `cd promptready_extension && npm install`
3. **Build Extension**: `npm run build`
4. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder
5. **Verify Installation**: Check that PromptReady appears in toolbar

### First Use

#### Quick Start Guide
1. **Navigate to Content**: Go to any webpage with text content
2. **Open Extension**: Click the PromptReady icon in your toolbar
3. **Choose Processing Mode**:
   - **Offline Mode** (Free): Instant local processing
   - **AI Mode** (Trial/BYOK): Enhanced AI-powered processing
4. **Capture Content**: Click "Capture Content" or use keyboard shortcut (Ctrl+Shift+P)
5. **Export Results**: Choose your preferred export method

---

## Processing Modes

### Offline Mode (Free)

#### Features
- **Instant Processing**: No network latency, completely local
- **Privacy First**: All processing happens on your device
- **Smart Extraction**: Mozilla Readability algorithm for content cleaning
- **Quality Assessment**: Automatic content quality scoring
- **Unlimited Use**: No credits or usage limits

#### Best For
- **Blog Posts and Articles**: Clean extraction of narrative content
- **Documentation Pages**: Technical content with code blocks
- **News Articles**: News site content with ads and navigation
- **Academic Papers**: Research papers and educational content

#### Configuration Options
```typescript
// Readability Presets
'blog-article'      // Optimized for blog posts and articles
'technical-documentation'  // Enhanced for technical docs
'wiki-content'       // Configured for wiki-style pages

// Turndown (HTML to Markdown) Presets
'standard'          // Balanced markdown conversion
'github'            // GitHub-flavored markdown with code highlighting
'obsidian'          // Obsidian-optimized with wiki links
```

#### Quality Settings
- **Post-Processing**: Content enhancement and optimization
- **Table of Contents**: Automatic heading-based TOC generation
- **Platform Optimization**: GitHub, Obsidian, or Standard formatting
- **Fallback Mechanisms**: Graceful degradation when extraction fails

### AI Mode (Trial/BYOK)

#### Features
- **Enhanced Quality**: Superior content structuring and cleaning
- **Context Understanding**: AI-powered content improvement
- **Smart Formatting**: Intelligent heading and list optimization
- **Citation Generation**: Automatic source attribution
- **Multiple Models**: Access to various AI models

#### Credit System

**Trial Mode**
- **150 Free Credits**: Monthly allowance for testing AI features
- **Credit Usage**: 1-5 credits per processing based on content size
- **Automatic Reset**: Credits reset on the 1st of each month
- **Usage Tracking**: Real-time credit balance and history

**BYOK Mode** (Bring Your Own Key)
- **Unlimited Processing**: No credit limits with your own API key
- **Model Choice**: Access to premium AI models
- **Cost Control**: Pay only for what you use
- **Privacy**: Your API key, your control

#### Supported AI Providers

**OpenRouter**
- **Models**: Llama 3.1, Mixtral 8x7B, and more
- **Features**: Wide model selection, competitive pricing
- **Setup**: Easy configuration with API key

**OpenAI**
- **Models**: GPT-3.5 Turbo, GPT-4 series
- **Features**: High-quality responses, reliable service
- **Setup**: Standard OpenAI API key configuration

**Anthropic**
- **Models**: Claude 3.5 Sonnet, Claude 3 series
- **Features**: Advanced reasoning, long context
- **Setup**: Anthropic API key configuration

**Custom Endpoints**
- **Flexibility**: Use any OpenAI-compatible API endpoint
- **Enterprise**: Compatible with corporate deployments
- **Advanced**: Custom headers and parameters

---

## Usage Guide

### Basic Workflow

#### Step 1: Content Selection
```
Method 1: Automatic Full Page
├─ Open any webpage
├─ Click PromptReady extension icon
├─ Extension automatically captures full page content
└─ Processing begins immediately

Method 2: Manual Text Selection
├─ Navigate to webpage
├─ Select specific text with mouse
├─ Click PromptReady extension icon
├─ Choose "Capture Selected Text"
└─ Only selected content is processed
```

#### Step 2: Processing
```
Processing Flow:
├─ Content validation and size check
├─ Mode selection (Offline/AI)
├─ Content extraction (Mozilla Readability)
├─ HTML to Markdown conversion
├─ Post-processing and optimization
├─ Quality assessment and scoring
└─ Metadata generation and citation insertion
```

#### Step 3: Export Options
```
Export Methods:
├─ Copy to Clipboard
│  ├─ Direct paste into any application
│  ├─ Cross-browser clipboard support
│  └─ Fallback mechanisms for compatibility
├─ Download as Markdown File
│  ├─ .md file with structured content
│  ├─ Source citations and metadata
│  └─ Compatible with Markdown editors
└─ Export as JSON
   ├─ Structured data with metadata
   ├─ Processing statistics and quality scores
   └─ Import for analysis or automation
```

### Advanced Features

#### Processing Profiles
Create custom profiles for different content types:

**Blog Profile**
```typescript
{
  name: "Blog Posts",
  description: "Optimized for articles and blog content",
  config: {
    readabilityPreset: "blog-article",
    turndownPreset: "standard",
    postProcessing: {
      enabled: true,
      addTableOfContents: true,
      optimizeForPlatform: "standard"
    }
  }
}
```

**Technical Documentation Profile**
```typescript
{
  name: "Technical Docs",
  description: "Enhanced for API docs and technical content",
  config: {
    readabilityPreset: "technical-documentation",
    turndownPreset: "github",
    postProcessing: {
      enabled: true,
      addTableOfContents: true,
      optimizeForPlatform: "github"
    }
  }
}
```

**Wiki Content Profile**
```typescript
{
  name: "Wiki Pages",
  description: "Configured for wiki-style content",
  config: {
    readabilityPreset: "wiki-content",
    turndownPreset: "standard",
    postProcessing: {
      enabled: true,
      addTableOfContents: true,
      optimizeForPlatform: "obsidian"
    }
  }
}
```

#### Developer Mode
Advanced debugging and development features:

**Activation**
1. Type "devmode" quickly in the popup
2. Extension will enter developer mode
3. Mode indicator shows "DEV" in popup header

**Features**
- **Unlimited AI Processing**: No credit consumption in developer mode
- **Advanced Export Options**: Raw HTML, code blocks, structured JSON
- **Debug Information**: Processing statistics and performance metrics
- **Pipeline Information**: View which processing pipeline was used

#### Keyboard Shortcuts

**Default Shortcuts**
- **Ctrl+Shift+P** (Windows/Linux)
- **Cmd+Shift+P** (Mac): Capture content

**Custom Shortcuts**
1. Go to `chrome://extensions/shortcuts`
2. Find "PromptReady"
3. Click "Edit" and set your preferred shortcut
4. Click "Save" to apply changes

### Performance Optimization

#### Large Content Handling
For documents larger than 100KB:

**Automatic Chunking**
- Content is automatically split into 100KB chunks
- Each chunk is processed individually
- Results are combined with separators
- Memory usage stays within limits

**Manual Optimization**
- Select specific text instead of full page
- Use offline mode for faster processing
- Clear cache regularly in settings

#### Cache Management
**Benefits**
- Faster processing for repeated content
- Reduced API calls for AI mode
- Offline capability for previously processed pages

**Cache Settings**
```typescript
interface CacheSettings {
  enableCaching: boolean;           // Enable/disable caching
  maxSize: number;                   // Maximum cache size (MB)
  ttl: number;                      // Time to live (hours)
  autoCleanup: boolean;               // Automatic cleanup of expired entries
}
```

#### Quality Optimization
**Content Quality Score** (0-100)
- **90-100**: Excellent quality, minimal post-processing needed
- **80-89**: Good quality, minor improvements applied
- **70-79**: Fair quality, significant post-processing
- **60-69**: Poor quality, extensive corrections needed
- **Below 60**: Very poor quality, consider reprocessing

**Quality Factors**
- **Structure Preservation**: How well headings/lists/tables are maintained
- **Readability Score**: Clarity and formatting of final markdown
- **Content Preservation**: Percentage of original content retained
- **Error/Warning Count**: Number of processing issues encountered

---

## Settings and Configuration

### Settings Panel

#### Accessing Settings
1. **Method 1**: Click gear icon ⚙️ in extension popup
2. **Method 2**: Right-click extension icon → "Options"
3. **Method 3**: Go to `chrome://extensions/` → Find PromptReady → "Options"

#### Settings Categories

**Processing Settings**
- **Default Mode**: Choose between Offline and AI mode
- **Readability**: Configure Mozilla Readability presets
- **Turndown**: HTML to Markdown conversion settings
- **Post-Processing**: Content enhancement options

**BYOK Configuration**
- **Provider Selection**: Choose AI provider (OpenRouter, OpenAI, Anthropic)
- **API Key Management**: Securely store and manage API keys
- **Model Selection**: Choose from available AI models
- **Custom Endpoints**: Configure custom API endpoints

**Performance Settings**
- **Caching**: Configure cache behavior and limits
- **Content Limits**: Set maximum content size for processing
- **Chunking**: Configure chunk size for large documents
- **Monitoring**: Enable/disable performance tracking

**UI Settings**
- **Theme**: Light, dark, or auto (system preference)
- **Animations**: Enable/disable UI animations
- **Compact Mode**: Reduce UI spacing for smaller screens
- **Language**: Interface language (if available)

**Privacy Settings**
- **Local Processing**: Preference for offline processing
- **Data Retention**: Configure how long to store processed content
- **Telemetry**: Control anonymous usage statistics
- **Secure Storage**: Enable/disable encrypted API key storage

### Import/Export Settings

**Export Settings**
```json
{
  "version": "1.0",
  "settings": {
    "mode": "ai",
    "readabilityPreset": "blog-article",
    "turndownPreset": "standard",
    "byokConfig": {
      "provider": "openrouter",
      "model": "llama-3.1-8b"
    },
    "performance": {
      "enableCaching": true,
      "maxContentLength": 1000000
    }
  },
  "exportedAt": "2024-01-15T10:30:00Z"
}
```

**Import Settings**
1. Go to Settings → Import/Export
2. Click "Import Settings"
3. Select exported settings file
4. Review imported settings
5. Click "Apply" to update configuration

---

## Troubleshooting

### Common Issues

#### Content Not Captured

**Problem**: Extension doesn't capture page content

**Solutions**:
1. **Refresh Page**: Sometimes pages need to be reloaded
2. **Check Compatibility**: Ensure page isn't a restricted Chrome page
3. **Try Text Selection**: Manually select text before capturing
4. **Disable Other Extensions**: Some extensions may conflict
5. **Check Permissions**: Ensure extension has necessary permissions

**Verification**:
- Open browser console (F12)
- Look for "Content script ready" message
- Check for any error messages

#### AI Mode Not Working

**Problem**: AI processing fails or shows errors

**Solutions**:
1. **Check Internet Connection**: AI mode requires network access
2. **Verify Credits**: Ensure you have available credits
3. **Check API Key**: For BYOK, verify your API key is valid
4. **Try Offline Mode**: Use offline mode as fallback
5. **Check Service Status**: Verify AI services are operational

**Debug Steps**:
```bash
# Check extension logs
1. Go to chrome://extensions/
2. Find PromptReady
3. Click "Inspect views: service worker"
4. Look for error messages in console
5. Check network tab for API requests
```

#### Clipboard Issues

**Problem**: Content doesn't copy to clipboard

**Solutions**:
1. **Grant Permissions**: Ensure clipboard permission is granted
2. **Try Manual Copy**: Copy from extension popup instead
3. **Check Browser Compatibility**: Ensure Chrome version is 88+
4. **Restart Browser**: Sometimes clipboard API needs reset
5. **Try Different Method**: Use download instead of copy

**Browser-Specific Fixes**:
```bash
# Chrome
- Check chrome://settings/content for clipboard permissions
- Ensure "Allow sites to see clipboard" is enabled

# Firefox
- Check about:config for clipboard settings
- Ensure dom.events.clipboardData.enabled is true
```

#### Performance Issues

**Problem**: Slow processing or high memory usage

**Solutions**:
1. **Clear Cache**: Remove old cached entries in settings
2. **Reduce Content Size**: Process smaller sections instead of full pages
3. **Disable Post-Processing**: Turn off enhancement features
4. **Use Offline Mode**: Faster processing without AI overhead
5. **Check System Resources**: Ensure sufficient available memory

**Performance Monitoring**:
- Open extension popup → Check Performance Dashboard
- Look for high memory usage warnings
- Review processing time trends
- Identify content types causing slowdowns

### Error Recovery

#### Automatic Recovery
The extension includes multiple recovery mechanisms:

**Fallback Processing**
- If Readability fails → Use simple text extraction
- If Turndown fails → Use basic HTML to markdown
- If AI fails → Switch to offline mode automatically
- If clipboard fails → Try alternative clipboard method

**Manual Recovery**
1. **Reload Extension**: Disable and re-enable extension
2. **Clear Data**: Use settings to clear all cached data
3. **Reset Configuration**: Restore default settings
4. **Reinstall Extension**: Remove and reinstall from store

#### Support Information

**What to Include in Support Requests**:
1. **Browser Information**: Chrome version, OS, extension version
2. **Error Messages**: Complete error text from console
3. **Steps to Reproduce**: Exact steps that caused the issue
4. **Page URL**: Specific page where issue occurred
5. **Content Sample**: Type of content being processed
6. **Settings Snapshot**: Export of current configuration

**Contact Methods**:
- **GitHub Issues**: [Create new issue](https://github.com/ham-zax/promptready_extension/issues)
- **Email Support**: support@promptready.io (if available)
- **Documentation**: Check [docs folder](https://github.com/ham-zax/promptready_extension/tree/main/docs)

---

## Tips and Best Practices

### Content Selection

#### For Best Results
- **Select Meaningful Chunks**: Instead of full pages, select relevant sections
- **Avoid Navigation Elements**: Don't include menus, headers, footers in selection
- **Include Context**: Select some surrounding text for better AI understanding
- **Clean Sources**: Choose well-structured articles over messy pages

#### Problematic Content Types
- **Highly Interactive Pages**: Web apps with complex JavaScript
- **Authentication Required**: Pages behind login walls
- **Dynamic Content**: Content that loads heavily via JavaScript
- **Protected Content**: DRM-protected or paywalled content

### Export Strategies

#### Choose Right Format
- **Markdown for Reading**: Best for text editors, note-taking apps
- **JSON for Automation**: Ideal for scripts, data processing
- **HTML for Preservation**: When you need original formatting

#### Citation Management
- **Always Include Citations**: Maintains source attribution
- **Customize Citation Format**: Configure preferred citation style
- **Batch Processing**: Process multiple related pages together
- **Maintain Context**: Keep source links for reference

### Performance Tips

#### Optimization Strategies
- **Use Offline Mode**: For faster processing of simple content
- **Enable Caching**: Faster processing of repeated content
- **Profile Content**: Create custom profiles for specific sites
- **Monitor Quality**: Regularly check processing quality scores

#### Memory Management
- **Process Smaller Sections**: Instead of entire pages
- **Clear Cache Regularly**: Prevent memory buildup
- **Close Unused Tabs**: Free up system resources
- **Restart Extension**: If performance degrades over time

---

## Integration Examples

### Note Taking Apps

#### Obsidian Integration
```markdown
# Processed content from PromptReady

> Source: [Article Title](https://example.com/article)
> Captured: 2024-01-15
> Hash: abc123def456

## Main Content

Your processed markdown content here...

### Tags
#web-clip #promptready #article-title

---

### Related
- [[Related Article 1]]
- [[Related Article 2]]
```

#### Notion Integration
```markdown
# Article Summary

**Source**: [Article Title](https://example.com)

**Captured**: 2024-01-15

**Content**
---
Your processed markdown content...

**Tags**
#promptready #article #research

**Categories**
📚 Research
📝 Notes
```

#### Logseq Integration
```markdown
# PromptReady Clip

**source-url::** https://example.com/article
**source-title::** Article Title
**captured-at::** 2024-01-15

**Content**
Your processed markdown content...

**tags**
promptready, article, research
```

### Writing Tools

#### VS Code Integration
```typescript
// In VS Code, use the JSON export for automated processing
const processedContent = {
  markdown: "# Processed Content\n\nFrom PromptReady...",
  metadata: {
    url: "https://example.com",
    title: "Article Title",
    capturedAt: "2024-01-15T10:30:00Z"
  }
};

// Use in your automated workflows
```

#### Sublime Text Integration
```markdown
<!-- PromptReady Content -->
<!-- Source: https://example.com -->
<!-- Captured: 2024-01-15 -->

Your processed markdown content
```

### Research Workflows

#### Academic Research
1. **Capture Multiple Sources**: Process related papers and articles
2. **Export as JSON**: Maintain structured metadata
3. **Import into Reference Manager**: Use JSON for automated import
4. **Create Literature Review**: Combine multiple processed documents

#### Content Analysis
1. **Batch Processing**: Use developer mode for unlimited processing
2. **Quality Assessment**: Review quality scores for each source
3. **Cross-Reference**: Use citation blocks to trace sources
4. **Data Export**: Export aggregated data for analysis

---

## Advanced Features

### Performance Dashboard

#### Real-time Monitoring
Access the performance dashboard to track:
- **Processing Speed**: Average time per operation
- **Success Rate**: Percentage of successful processing
- **Quality Trends**: Historical quality score patterns
- **Memory Usage**: Current and peak memory consumption
- **Cache Efficiency**: Hit rates and retrieval performance

#### Performance Optimization
Based on dashboard insights:
- **Adjust Settings**: Optimize for your content types
- **Profile Performance**: Identify best-performing configurations
- **Monitor Bottlenecks**: Find processing bottlenecks
- **Quality Improvement**: Target low-quality content types

### Developer Tools

#### Debug Information
Developer mode provides detailed technical information:
- **Pipeline Used**: Which processing path was taken
- **Processing Time**: Detailed timing breakdown
- **Content Statistics**: Size, type, and complexity metrics
- **Error Tracing**: Complete error context and stack traces
- **Network Requests**: All API calls and responses

#### Custom Processing
Create your own processing workflows:
- **Export Raw Data**: Access to intermediate processing results
- **Custom Scripts**: Use JSON export for automation
- **Integration Hooks**: Connect with external tools and APIs

---

*This user guide covers all aspects of using the PromptReady extension, from basic usage to advanced features and integrations. For specific technical details, refer to the [API Reference](./API_REFERENCE.md) and [Component Library](./REACT_COMPONENTS.md) documentation.*