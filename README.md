# PromptReady - AI-Powered Content Cleaning Extension

A sophisticated Chrome extension that instantly cleans and structures webpage content into prompt-ready formats. Features advanced AI processing with a metered freemium model and BYOK (Bring Your Own Key) support.

## Features

### 🔄 Dual Processing Modes
- **Offline Mode**: Instant, private content cleaning using advanced rules-based engine
- **AI Mode**: Enhanced processing with AI models for superior content structuring

### 🎯 Smart Content Processing
- **Hybrid Pipeline**: Intelligently selects between standard readability and advanced bypass processing
- **Quality Scoring**: Automatic content quality assessment with detailed scoring engine
- **Citation Preservation**: Maintains source URLs and timestamps for proper attribution

### 💰 Monetization Model
- **Free Trial**: 150 monthly credits for AI mode testing
- **BYOK Upgrade**: Connect your own API key for unlimited processing
- **Advanced Models**: Access to premium AI models when using BYOK

### 🛡️ Enterprise-Grade Security
- **Budget Protection**: Global circuit breaker prevents cost overruns
- **Local Storage**: All settings and API keys stored locally
- **Privacy-First**: No user content stored on servers

## Quick Start

### Installation (Development)
```bash
# Clone the repository
git clone https://github.com/ham-zax/promptready_extension.git
cd promptready_extension

# Install dependencies
npm install

# Build for development
npm run dev

# Load in Chrome
1. Open Chrome and go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
```

### Basic Usage
1. **Select Content**: Highlight text on any webpage
2. **Choose Mode**: Toggle between Offline (free) and AI (trial/BYOK) modes
3. **Process**: Click "Capture Content" to clean and structure
4. **Export**: Copy to clipboard or save as Markdown/JSON

## Backend Setup

### Cloudflare Workers Deployment
The extension requires three Cloudflare Worker functions:

1. **Credit Service**: User credit tracking and management
2. **AI Proxy**: Secure AI processing with credit validation
3. **Circuit Breaker**: Budget protection and rate limiting

```bash
# Deploy each function
cd functions/credit-service
wrangler deploy

cd functions/ai-proxy  
wrangler deploy

cd functions/circuit-breaker
wrangler deploy
```

### Environment Variables
Configure these in your Cloudflare Workers:
- `AI_API_KEY`: Groq API key for trial processing
- `SERVICE_SECRET`: Internal service authentication
- `CREDITS_KV`: KV namespace for user credits
- `BUDGET_KV`: KV namespace for budget tracking

## Architecture

### Extension Structure
```
├── entrypoints/
│   ├── background.ts          # Service worker orchestrator
│   ├── content.ts            # Content capture and clipboard
│   ├── offscreen/            # Document processing pipeline
│   └── popup/                # React UI components
├── functions/                # Cloudflare Workers
│   ├── credit-service/       # User credit management
│   ├── ai-proxy/            # AI processing proxy
│   └── circuit-breaker/      # Budget protection
├── core/                     # Processing engines
│   ├── scoring/             # Content quality assessment
│   └── filters/             # Boilerplate removal
└── pro/                     # Monetization clients
```

### Processing Pipeline
1. **Content Capture**: Secure DOM extraction with metadata
2. **Mode Selection**: Offline vs AI processing based on user settings
3. **Quality Enhancement**: Hybrid pipeline with intelligent bypass
4. **Output Generation**: Markdown with citations and quality scores

## Development Status

### ✅ Implemented Features (95% Complete)
- Complete backend services (credit tracking, AI proxy, circuit breaker)
- Sophisticated content processing with hybrid pipeline
- Full monetization system with trial → BYOK upgrade flow
- Advanced UI components and settings management
- Quality scoring and content assessment
- Cross-platform clipboard integration

### 🔄 Remaining Work
- Complete citation formatting implementation
- Performance optimization and testing
- Additional AI model integrations

## Configuration

### Extension Settings
- **Mode Preference**: Default to Offline or AI mode
- **BYOK Providers**: OpenRouter, OpenAI, or custom endpoints
- **Model Selection**: Advanced AI models for BYOK users
- **Privacy Options**: Opt-in telemetry and data preferences

### Quality Settings
- **Processing Thresholds**: Custom quality scoring thresholds
- **Citation Format**: APA, MLA, or custom citation styles
- **Export Formats**: Markdown, JSON, or plain text

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `docs/` folder
- Review the architecture documentation for technical details

---

**Built with WXT + React** • **Powered by Groq AI** • **Protected by Cloudflare**