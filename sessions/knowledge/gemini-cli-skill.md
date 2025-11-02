---
name: gemini-cli
description: Use when the user asks to run Gemini CLI for code analysis, automation, or development tasks
---

# Gemini CLI Skill Guide

## Running a Task
1. Ask the user which authentication they prefer: **Login with Google** (OAuth, 60 requests/min, 1,000/day free) or **API Key** (requires `GEMINI_API_KEY`) or **Vertex AI** (enterprise with `GOOGLE_API_KEY`)
2. Select model: `gemini-2.5-pro` (default, 1M token context) or `gemini-2.5-flash` (faster)
3. Choose mode: Interactive (default) or headless with `--prompt`/`-p`
4. Choose output format: `text` (default), `json`, or `stream-json`
5. Assemble command:
   - `-p, --prompt` - Headless mode
   - `-m, --model` - Model selection  
   - `--output-format` - Output format
   - `--include-directories` - Additional dirs
   - `--yolo, -y` - Auto-approve actions
   - `--approval-mode` - Approval mode
6. Execute command and summarize results
   - **CRITICAL**: Never ask Gemini to use tools in prompts - provide all context directly
7. After completion, ask if user wants to continue with additional analysis

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Interactive analysis | `gemini` |
| Headless query | `gemini -p "query"` |
| JSON output | `gemini -p "query" --output-format json` |
| Include directories | `gemini -p "query" --include-directories src,docs` |
| Auto-approve | `gemini -p "query" --yolo` |

## Use Cases
- **Code Analysis**: `gemini -p "Find bugs in src/auth.py" --include-directories src`
- **Code Generation**: `gemini -p "Create REST API with Express.js"`
- **Documentation**: `gemini -p "Generate README for this project"`
- **Automation**: `git diff | gemini -p "Write commit message" --output-format json | jq -r '.response'`

## Following Up
- After every command, summarize results and ask for next steps
- For JSON output, parse with `jq -r '.response'` to extract content
- Suggest follow-up actions based on results

## Error Handling
- Check installation with `gemini --version`
- Verify authentication is configured
- Handle non-zero exit codes appropriately
- Parse JSON safely (check for error field)
- Respect rate limits (60/min free tier)

## Important Notes
- Requires **Node.js 20+**
- Context window: **1M tokens** with gemini-2.5-pro
- Built-in tools: File operations, shell commands, web fetch & search, MCP integration
- Open source: Apache 2.0 licensed

---

**When to use this skill**: Invoke this skill when the user asks to run Gemini CLI, analyze code with Gemini, automate tasks with Gemini, or mentions using Google's Gemini CLI tool for development work.