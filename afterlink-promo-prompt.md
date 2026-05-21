# Prompt: Update AfterLink Main Repo & Website to Promote Agent Skill

## Context

AfterLink now has an official AI agent skill published at `https://github.com/AJAYMYTH/afterlink-skill`. This skill lets AI coding agents (Claude Code, Cursor, Copilot, Windsurf, 40+ more) install AfterLink knowledge directly into their context via:

```bash
npx skills add AJAYMYTH/afterlink-skill
```

I need to update two places to promote this:

---

## Task 1: Update Main GitHub Repo README (`https://github.com/AJAYMYTH/AfterLink`)

Add a new section to the README (near the top, after the header/badges) that:

1. **Announces the agent skill** with a clear headline like "AI Agent Skill" or "Use with AI Coding Agents"
2. **Shows the install command** in a code block:
   ```bash
   npx skills add AJAYMYTH/afterlink-skill
   ```
3. **Explains what it does** — AI agents that install this skill automatically know how to build AfterLink apps, including server setup, pub/sub, streaming, middleware, TLS, browser bridges, testing, error handling, and CLI debugging
4. **Lists supported agents** — Claude Code, Cursor, GitHub Copilot, Windsurf, OpenCode, and 40+ more
5. **Links to the skill repo** — `https://github.com/AJAYMYTH/afterlink-skill`
6. **Adds a badge** to the top badges section:
   ```
   [![Agent Skill](https://img.shields.io/badge/Agent_Skill-npx_skills_add-blue)](https://github.com/AJAYMYTH/afterlink-skill)
   ```

---

## Task 2: Update AfterLink Docs Website (`https://afterlinkdocs.vercel.app`)

Add a new page or section called "AI Agent Skill" that includes:

1. **What is the AfterLink Agent Skill** — one paragraph explaining that it's a skill package AI coding agents can install to gain full knowledge of AfterLink's API, patterns, and best practices
2. **Install command** — `npx skills add AJAYMYTH/afterlink-skill`
3. **What the skill covers** — list the 10 task areas:
   - Scaffold new server + client
   - Pub/Sub pattern
   - Streaming (STREAM frames)
   - Middleware (JWT auth + logging)
   - TLS (dev certs + production)
   - Browser WebSocket bridge
   - Health endpoint setup
   - Rate limiting + compression
   - Integrating into existing projects
   - Writing tests for AfterLink routes
4. **Supported agents** table — Claude Code, Cursor, GitHub Copilot, Windsurf, OpenCode, 40+ more
5. **Why use it** — 2-3 sentences explaining that instead of reading docs manually, developers can just tell their AI agent "use AfterLink" and the agent already has all the patterns, code examples, and API reference loaded
6. **Link to skill repo** — `https://github.com/AJAYMYTH/afterlink-skill`
7. **Link to skills.sh directory** — `https://skills.sh`

---

## Quality Requirements

- Keep the tone developer-friendly and concise
- Don't oversell — just state the facts: it exists, here's how to install, here's what it does
- Use the exact install command: `npx skills add AJAYMYTH/afterlink-skill`
- Link to the skill repo: `https://github.com/AJAYMYTH/afterlink-skill`
- Make sure the README section fits naturally with the existing content
- For the docs site, follow the existing documentation style and navigation structure

---

## Output

Produce:
1. The updated README.md content for the main AfterLink repo (show the full file or clearly mark what to add and where)
2. The new docs page content (markdown format, ready to drop into the docs site)
