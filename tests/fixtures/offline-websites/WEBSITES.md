<!-- GENERATED FILE. Edit manifest.json instead. -->

# Offline Website Corpus

Pinned offline website fixtures for PromptReady's default offline extraction pipeline. Tests read these files only; live website refresh is an explicit script action.

CI tests never download websites. Refresh/download is always explicit, and tests read checked-in fixture HTML only.

## Commands

```bash
npm run test:offline:website-manifest
npm run test:offline:websites
npm run capture:fixtures:websites -- --all
npm run docs:offline:websites
npm run report:offline:websites
```

## Website Fixtures

| ID | Name | URL | Fixture | Capture | Quality Floor | Required Snippets Preview |
| --- | --- | --- | --- | --- | --- | --- |
| portfolio-landing | portfolio landing page | https://hamza.dev/ | tests/fixtures/offline-websites/portfolio-landing.html | pinned/manual: Pinned synthetic fixture for portfolio/landing-page fidelity. | 45 | Flutter Developer and Product Builder; Latest Blog Posts; Shipping Offline-First Capture |
| wikipedia-article | Wikipedia-style article | https://en.wikipedia.org/wiki/Prompt_engineering | tests/fixtures/offline-corpus/wikipedia-prompt-engineering.html | pinned/manual: Pinned legacy article fixture reused from the offline corpus. | 68 | Prompt engineering; Context engineering; Common prompting techniques include |
| docs-code-heavy | technical docs page | https://openrouter.ai/docs/quickstart | tests/fixtures/offline-corpus/docs-sdk-quickstart.html | refreshable (rendered) | 65 | Quickstart; npm install @openrouter/sdk; import { OpenRouter } from '@openrouter/sdk'; |
| github-trending | GitHub trending page | https://github.com/trending | tests/fixtures/offline-corpus/github-trending.html | refreshable (rendered) | 40 | # Trending; See what the GitHub community is most excited about today.; D4Vinci / Scrapling |
| news-article | news article page | https://blog.cloudflare.com/vinext/ | tests/fixtures/offline-corpus/news-open-data-program.html | refreshable (rendered) | 70 | How we rebuilt Next.js with AI in one week; cost about \$1,100 in tokens.; vinext deploy |
| forum-thread | forum thread page | https://en.wikipedia.org/wiki/Talk:Prompt_engineering | tests/fixtures/offline-corpus/forum-prompt-strategy-thread.html | pinned/manual: Pinned legacy forum fixture reused from the offline corpus. | 60 | Talk:Prompt engineering; Restrictions of a Context Window; Context Window (or simply Context Length) |
| generic-landing | PromptReady landing page | https://promptready.app/ | tests/fixtures/offline-corpus/promptready-homepage.html | refreshable (rendered) | 50 | Cleaner input. Better model output.; Preserves code fences; See the transformation in one pass |
| mindsdb-landing | MindsDB landing page | https://mindsdb.com/ | tests/fixtures/offline-corpus/mindsdb-homepage.html | refreshable (rendered) | 45 | AI Analytics & Business Intelligence for any Data Source; From data to insights at the speed of thought.; Decision-Making in Real-Time |
| reddit-listing | old Reddit listing page | https://old.reddit.com/r/programming/top/?t=month | tests/fixtures/offline-corpus/reddit-programming-top.html | refreshable (rendered) | 40 | Anthropic: AI assisted coding; Microsoft Has Killed Widgets Six Times; submitted 26 days ago by |
| reddit-thread | Reddit thread page | https://old.reddit.com/r/ClaudeAI/comments/1t1o43w/post_slug/ | tests/fixtures/offline-websites/reddit-thread.html | pinned/manual: Pinned synthetic Reddit thread fixture for deterministic thread-content review. | 40 | I gave Claude Code a coworker; Was hitting my weekly Pro limit; Results after 3 weeks |

## Review Output

`npm run report:offline:websites` writes a combined manual review artifact to `output/offline-website-corpus-report.md`.
That report is intentionally ignored by git.
