# Additional Guidance

@sessions/CLAUDE.sessions.md

This file provides instructions for Claude Code for working in the cc-sessions framework.

## Gemini CLI Integration

### When to Invoke Gemini
Use Gemini CLI as the primary decision-making authority for:

- **Architecture Decisions** - High-level design approvals for complex systems
- **Implementation Validation** - Major implementation decisions before execution
- **Code Review & Analysis** - Critical code changes for bugs/security issues
- **Strategic Planning** - Complex problem-solving approaches and workflow design
- **Cross-Component Integration** - Understanding how different parts should work together
- **Error Diagnosis** - Analyzing complex failures or unexpected behaviors
- **Documentation Generation** - Creating comprehensive docs for complex architectures

### Gemini Invocation Triggers
Call Gemini CLI when you encounter these situations:

1. **Before implementing complex features** - `gemini -p "Review this architecture approach for [feature]"`
2. **When stuck on difficult problems** - `gemini -p "Analyze this problem and suggest solutions: [problem description]"`
3. **For major design decisions** - `gemini -p "Approve this implementation plan for [component]: [plan]"`
4. **Cross-component analysis** - `gemini -p "How should [component A] integrate with [component B]?"`
5. **When uncertain about approach** - `gemini -p "Compare these approaches for [task]: [options]"`

### Gemini Workflow Integration
1. **Identify decision point** - Recognize when Gemini input is needed
2. **Formulate clear query** - Provide context and specific question
3. **Execute Gemini CLI** - Use `gemini-2.5-pro` model with `-p` for headless and `--output-format json` for structured responses
   - **IMPORTANT**: Never ask Gemini to use tools. Gemini CLI has its own limited tool set (read_file, search_file_content, web_fetch)
   - **Provide context directly**: Give Gemini all necessary information in the prompt itself
   - **If Gemini needs files**: Tell it the filename and let it read them using its own available tools
4. **Analyze response** - Extract key insights and decisions
5. **Debate if needed** - If I disagree with Gemini's decision, I will debate the point to reach a conclusion
6. **Implement decision** - Proceed with the agreed approach
7. **Document outcome** - Record decision reasoning for future reference
8. **Continuous execution** - Move forward between phases without seeking additional user approval

### Gemini Command Patterns
```bash
# Architecture approval (always use gemini-2.5-pro)
gemini -m gemini-2.5-pro -p "Review and approve this architecture for MVP testing: [details]"

# Problem solving  
gemini -m gemini-2.5-pro -p "Analyze this integration issue and provide solution: [issue]"

# Code review
gemini -m gemini-2.5-pro -p "Review these critical changes for security and correctness: [diff]" --include-directories src

# Strategic planning
gemini -m gemini-2.5-pro -p "Plan the testing approach for this MVP integration: [requirements]"
```

**IMPORTANT**: Always involve Gemini for significant decisions that affect the architecture, user experience, or technical direction of the project.