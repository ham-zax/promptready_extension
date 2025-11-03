# Reddit Extraction Comparison: API vs DOM Scraping

## Comparison with PRAW (Python Reddit API)

### What PRAW Gets (Official API):
```python
post = {
    "id": "t3_1mnqsg7",
    "title": "SuperClaude workflows",
    "body": "Hi everyone, I've been working with SuperClaude...",  # selftext
    "created_utc": 1234567890,
    "subreddit": "ClaudeCode",
    "url": "/r/ClaudeCode/comments/1mnqsg7/superclaude_workflows/",
    "type": "post"
}

comment = {
    "id": "t1_n87fjch",
    "title": "SuperClaude workflows",  # parent post title
    "body": "I've found that...",       # comment.body
    "created_utc": 1234567891,
    "url": "/r/ClaudeCode/comments/.../comment_id",
    "type": "comment"
}
```

### What We Extract (DOM Scraping):
```typescript
// Our extraction targets the SAME content in the DOM:

// Post title (same as PRAW post.title)
shreddit-title h1
→ "SuperClaude workflows"

// Post body (same as PRAW post.selftext)
shreddit-post-text-body div[id*="-post-rtjson-content"]
→ "Hi everyone, I've been working with SuperClaude..."

// Comments (same as PRAW comment.body)
shreddit-comment [slot="comment"]
→ "I've found that..."
```

## Architecture Comparison

### PRAW (API-based):
```
Python Script
   ↓
Reddit API (praw.Reddit)
   ↓
post.selftext → "Post body text"
comment.body → "Comment text"
```

**Advantages:**
- ✅ Structured data
- ✅ Rate limiting built-in
- ✅ Pagination support
- ✅ Authentication for private content

**Limitations:**
- ❌ Requires API credentials
- ❌ Rate limits (60 requests/min default)
- ❌ Server-side only
- ❌ Cannot capture user's current view

### Our Extension (DOM-based):
```
Browser Extension
   ↓
Content Script (in-page access)
   ↓
DOM selectors → Extract visible content
   ↓
shreddit-post-text-body div[id*="-post-rtjson-content"]
shreddit-comment [slot="comment"]
```

**Advantages:**
- ✅ No API credentials needed
- ✅ No rate limits
- ✅ Captures exactly what user sees
- ✅ Works with any Reddit page user visits
- ✅ Client-side extraction (instant)

**Limitations:**
- ❌ Depends on DOM structure (can break with Reddit updates)
- ❌ Requires complex selectors
- ❌ Must handle Shadow DOM
- ❌ Must filter UI noise

## Equivalent Data Extraction

| PRAW API | Our DOM Selector | Status |
|----------|------------------|--------|
| `post.title` | `shreddit-title h1` | ✅ Working |
| `post.selftext` | `div[id*="-post-rtjson-content"]` | ✅ Implemented |
| `comment.body` | `shreddit-comment [slot="comment"]` | ✅ Implemented |
| `post.created_utc` | Could parse from "3mo ago" | ⏳ Not needed |
| `post.permalink` | `window.location.href` | ✅ Working |
| `comment.depth` | `shreddit-comment[depth="0"]` | ✅ Working |

## Key Insight from PRAW Code

### Comment Fetching Strategy:
```python
# PRAW loads all comments at once
post.comments.replace_more(limit=0)
for comment in post.comments.list():
    # Recursive iteration through comment tree
```

### Our Equivalent:
```typescript
// We query all comment slots at once
const commentElements = document.querySelectorAll('shreddit-comment [slot="comment"]');

// Get depth for threading
const depth = commentEl.closest('shreddit-comment')?.getAttribute('depth') || '0';
const indent = '  '.repeat(parseInt(depth));
```

## Why Our Approach Works

Reddit renders **the same content** that the API provides, just wrapped in Shadow DOM and web components. The actual text content (`post.selftext` and `comment.body`) is present in the DOM, just in specific locations:

1. **Post body** → Inside `div[id*="-post-rtjson-content"]`
2. **Comment text** → Inside `[slot="comment"]` elements
3. **Structure** → Preserved via `depth` attributes

## Testing Equivalence

### PRAW would get:
```json
{
  "title": "SuperClaude workflows",
  "body": "Hi everyone, I've been working with SuperClaude for some projects, but I keep running into the same issues...",
  "comments": [
    {
      "body": "I've found that...",
      "depth": 0
    },
    {
      "body": "Thanks for the tip!",
      "depth": 1
    }
  ]
}
```

### We extract (after our fixes):
```markdown
# SuperClaude workflows

## Post

Hi everyone, I've been working with SuperClaude for some projects, but I keep running into the same issues...

## Comments (2)

- I've found that...

  - Thanks for the tip!
```

**Result:** Same content, different format! ✅

## Conclusion

Our DOM-based extraction is now targeting **exactly the same data** that PRAW gets from the API, just by scraping the rendered HTML instead of calling the API.

**Advantages of our approach:**
- No API keys required
- No rate limits
- Works on user's active tab
- Instant extraction
- Captures user's exact view

**Trade-off:**
- More fragile (DOM changes can break it)
- Must handle Shadow DOM complexity
- Requires UI noise filtering

**Status:** ✅ Implementation complete and equivalent to PRAW data extraction

