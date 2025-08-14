# PromptReady Quick Testing Guide

**Purpose:** Immediate testing reference for core functionality validation  
**Time Required:** 30 minutes for basic validation, 2 hours for comprehensive testing

## Pre-Testing Setup (5 minutes)

### 1. Extension Installation
```bash
# Load extension in Chrome
1. Open Chrome → Extensions → Developer mode ON
2. Click "Load unpacked" → Select PromptReady folder
3. Verify extension icon appears in toolbar
4. Check permissions granted (activeTab, storage, etc.)
```

### 2. Test API Keys (Optional for BYOK testing)
- **OpenRouter:** Get free API key from openrouter.ai
- **OpenAI:** Use existing API key or create test account
- **Test Amount:** $5-10 credit sufficient for validation

### 3. Test Content Library
Bookmark these for consistent testing:
- **News:** https://techcrunch.com/latest-article
- **Docs:** https://developer.mozilla.org/en-US/docs/Web/API
- **Social:** https://twitter.com/any-thread
- **E-commerce:** https://amazon.com/any-product
- **Academic:** https://arxiv.org/any-paper

## 30-Minute Smoke Test

### Test 1: Basic Offline Mode (10 minutes)
1. **Open TechCrunch article**
2. **Select 2-3 paragraphs**
3. **Press Ctrl+Shift+L**
4. **Verify popup shows processing**
5. **Check markdown output quality**
6. **Test copy to clipboard**

**✅ Success Criteria:**
- Processing completes in <5 seconds
- Markdown formatting looks clean
- Copy function works
- No error messages

### Test 2: Full Page Capture (10 minutes)
1. **Open MDN documentation page**
2. **Click extension icon (no selection)**
3. **Press Ctrl+Shift+L**
4. **Wait for processing completion**
5. **Review full page markdown**
6. **Check code blocks and tables**

**✅ Success Criteria:**
- Full page captured successfully
- Code syntax preserved
- Tables converted to markdown
- Navigation menus excluded

### Test 3: BYOK Basic Test (10 minutes)
1. **Open extension popup**
2. **Click settings gear icon**
3. **Enter OpenRouter API key**
4. **Select GPT-4 model**
5. **Toggle to AI mode**
6. **Capture same TechCrunch content**
7. **Compare with offline result**

**✅ Success Criteria:**
- API key saves successfully
- AI mode processes content
- Output shows enhancement
- No API errors

## 2-Hour Comprehensive Test

### Hour 1: Content Type Validation

#### Test A: News Articles (15 min)
**Sites:** TechCrunch, BBC, CNN, Ars Technica
- Test selection capture
- Test full page capture
- Verify image handling
- Check citation footer

#### Test B: Documentation (15 min)
**Sites:** MDN, GitHub docs, Stack Overflow, API docs
- Code block preservation
- Table formatting
- Internal link handling
- Heading hierarchy

#### Test C: Social Media (15 min)
**Sites:** Twitter threads, LinkedIn posts, Reddit discussions
- Thread conversation flow
- User mentions and hashtags
- Embedded media handling
- Reply structure

#### Test D: E-commerce (15 min)
**Sites:** Amazon, product pages, review sites
- Product descriptions
- Specification tables
- Customer reviews
- Image galleries

### Hour 2: Advanced Testing

#### Test E: BYOK Provider Testing (30 min)
1. **OpenRouter with GPT-4**
   - Configure and test
   - Process 3 different content types
   - Record quality improvements

2. **OpenRouter with Claude**
   - Switch models
   - Process same content
   - Compare outputs

3. **Error Scenarios**
   - Invalid API key
   - Network timeout
   - Rate limiting

#### Test F: Performance & Edge Cases (30 min)
1. **Large Content**
   - Very long articles (>10K words)
   - Complex pages with heavy DOM
   - Multiple embedded media

2. **Edge Cases**
   - Pages with no selectable text
   - Protected/restricted content
   - Malformed HTML

3. **Performance Monitoring**
   - Processing times
   - Memory usage
   - CPU utilization

## Common Issues & Solutions

### Issue: "No content captured"
**Causes:**
- Page has no selectable text
- Content is in iframe or shadow DOM
- JavaScript-rendered content not loaded

**Solutions:**
- Wait for page to fully load
- Try full page capture instead of selection
- Refresh page and retry

### Issue: "API key invalid"
**Causes:**
- Incorrect API key format
- Expired or revoked key
- Wrong provider selected

**Solutions:**
- Verify API key from provider dashboard
- Check provider selection matches key
- Test key with provider's API directly

### Issue: "Processing timeout"
**Causes:**
- Very large content
- Network connectivity issues
- Provider API slowness

**Solutions:**
- Try smaller content selection
- Check internet connection
- Switch to offline mode temporarily

### Issue: "Poor markdown quality"
**Causes:**
- Complex page layout
- Heavy use of CSS styling
- Non-standard HTML structure

**Solutions:**
- Try different content selection
- Use AI mode for better processing
- Adjust processing settings

## Quality Assessment Checklist

### Content Preservation
- [ ] All important text captured
- [ ] No missing paragraphs or sections
- [ ] Proper text flow maintained
- [ ] Links and references preserved

### Structure Integrity
- [ ] Heading hierarchy correct
- [ ] List formatting maintained
- [ ] Table structure intact
- [ ] Code blocks properly formatted

### Markdown Quality
- [ ] Valid markdown syntax
- [ ] Consistent formatting style
- [ ] Clean whitespace handling
- [ ] Proper link formatting

### Performance
- [ ] Processing time acceptable
- [ ] Memory usage reasonable
- [ ] No browser freezing
- [ ] Responsive user interface

## Test Results Documentation

### Quick Results Template
```
Date: ___________
Tester: ___________
Duration: ___________

OFFLINE MODE:
- News articles: ✅/❌
- Documentation: ✅/❌  
- Social media: ✅/❌
- Performance: ✅/❌

BYOK MODE:
- OpenRouter: ✅/❌
- Model switching: ✅/❌
- Error handling: ✅/❌

UI/UX:
- Popup interface: ✅/❌
- Keyboard shortcuts: ✅/❌
- Settings panel: ✅/❌

CRITICAL ISSUES:
1. ________________
2. ________________

OVERALL STATUS: Ready/Needs Work
```

## Next Steps After Testing

### If Tests Pass (>90% success rate)
1. Document any minor issues found
2. Create user documentation
3. Prepare for Phase 2 backend development
4. Consider beta testing with real users

### If Tests Fail (<90% success rate)
1. Prioritize critical issues for immediate fixing
2. Re-test after fixes implemented
3. Consider additional testing scenarios
4. Delay Phase 2 until core stability achieved

### Continuous Testing
- Test daily during development
- Rotate through different content types
- Monitor performance trends
- Document edge cases discovered

This guide ensures your core functionality is rock-solid before adding backend complexity!
