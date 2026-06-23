# Palmkit

[![Palmkit](./public/social_preview_index.jpg)](https://palmkit.app)

**Palmkit** is an open-source, AI-powered full-stack web development platform that runs in the browser. Users describe an app in natural language and Palmkit builds a working preview — static HTML/CSS/JS, Vite + React, Next.js, Express, or Python.

> Fork of [Bolt.diy](https://github.com/stackblitz-labs/bolt.diy) with significant prompt-engineering and infrastructure work on top. See [`ROADMAP.md`](./ROADMAP.md) for the full techniques ledger and phased plan.

---

## Table of Contents

- [What is Palmkit](#what-is-palmkit)
- [Tech Stack](#tech-stack)
- [Live Site](#live-site)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Project Status & Roadmap](#project-status--roadmap)
- [Available Scripts](#available-scripts)
- [License](#license)

---

## What is Palmkit

Palmkit turns a natural-language prompt into a runnable web app:

1. User describes an app ("Build a coffee shop landing page with hero, menu, contact form").
2. Palmkit calls an LLM (via OpenRouter, Anthropic, OpenAI, etc.) with a tightly-engineered system prompt.
3. The LLM returns code wrapped in `<palmkitArtifact>` / `<palmkitAction>` tags.
4. Palmkit's parser writes each file to a WebContainer / E2B sandbox.
5. The preview renders live in an iframe.

**19+ LLM providers** supported: OpenAI, Anthropic, Google, Groq, xAI, DeepSeek, Mistral, Cohere, Together, Perplexity, HuggingFace, Ollama, LM Studio, OpenRouter, Moonshot, Hyperbolic, GitHub Models, Amazon Bedrock, OpenAI-like.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Remix + Vite |
| **Runtime** | Cloudflare Pages (Workers runtime) |
| **AI Providers** | OpenRouter + 18 others (via Vercel AI SDK) |
| **Auth + DB** | Supabase (Postgres + Auth + Storage) |
| **Code Sandbox** | WebContainer (desktop) / E2B (mobile) |
| **Desktop** | Electron |
| **Deploy Targets** | Netlify, Vercel, GitHub Pages, Palmkit internal hosting (`/p/{slug}`) |

---

## Live Site

- **Production**: https://palmkit.app
- **Cloudflare Pages project**: `mobile-ai-dev-workspace`
- **Repo**: https://github.com/6eu6/Palmkit

---

## Quick Start

### Prerequisites

- Node.js LTS
- pnpm (`npm install -g pnpm`)

### Local Development

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local — at minimum set OPENROUTER_API_KEY and SUPABASE_* vars
pnpm run dev
```

App runs at `http://localhost:5173`.

### Docker

```bash
cp .env.example .env.local
pnpm run dockerbuild         # dev image
docker compose --profile development up
```

### Desktop (Electron)

```bash
pnpm install
pnpm electron:build:dist     # all platforms
# or: pnpm electron:build:mac / win / linux
```

Download a pre-built binary from [Releases](https://github.com/6eu6/Palmkit/releases/latest).

---

## Configuration

All configuration lives in `.env.local`. Key variables:

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Default LLM provider |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Auth + project storage |
| `E2B_ACCESS_TOKEN` | Mobile sandbox runtime |
| `VITE_DEPLOYMENT_PLATFORM_*` | Netlify / Vercel / GitHub deploy |

Provider API keys can also be entered per-user via the in-app **Edit API Key** dialog (stored server-side, never in localStorage).

See [`.env.example`](./.env.example) for the full list.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (Remix SPA)                                          │
│  ├── Chat UI                                                 │
│  ├── Workbench (Monaco editor + file tree)                   │
│  ├── Preview iframe                                          │
│  └── IndexedDB / OPFS  ← project file content (planned)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│ Cloudflare Pages Function (Remix)                           │
│  ├── /api/chat        ← streaming LLM call (Phase 1: gate)  │
│  ├── /api/models      ← list available models               │
│  ├── /api/deploy/*    ← internal hosting                    │
│  └── /api/account/*   ← user project sync                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   OpenRouter         Supabase            E2B / WebContainer
   (LLM stream)       (auth + jobs +      (code execution)
                       file manifest)
```

**Current limitation** (driving the roadmap): `/api/chat` is a single long-lived Cloudflare Pages Function that streams the entire project in one response. For large projects this exceeds CF's CPU limits → stream cuts off → broken preview. **Phase 1** adds a Safety Gate to prevent broken previews; **Phase 2** moves generation to an external durable worker. See [`ROADMAP.md`](./ROADMAP.md).

---

## Project Status & Roadmap

Palmkit is under active development. The full techniques ledger (applied ✓ and pending ○) and the phased plan live in:

### ➡️ [`ROADMAP.md`](./ROADMAP.md)

**Quick summary**:

| Phase | Status | Goal |
|-------|--------|------|
| **Phase 1 — Safety Gate** | 🚧 In progress | Prevent broken previews via completion marker + validator + retry-limited state machine |
| **Phase 2 — Build Orchestrator** | ○ Planned | External durable worker (CF Workflows or Render/Railway), file-operations JSON, SSE progress |
| **Phase 3 — Repair Loop + Patches** | ○ Planned | Real `npm run build` in sandbox, repair agent, patch-only edits, Ready-for-Preview Gate |

Applied techniques (14 items, all ✓): file completeness rules, mobile-first, framework guidance, design standards, adaptive intelligence, CL4R1T4S patterns (tone/honesty/owns-mistakes), MANDATORY artifact enforcement, complete HTML/CSS/JS example, slim example, token budget (⚠️ to be removed in Phase 1).

Pending techniques (21 items, all ○): `__PALMKIT_DONE__` marker, output validator, status state machine, retry-limited, `build_jobs` / `build_steps` / `project_files_manifest` tables, browser storage, `BuildRunner` interface, frontend status UI, external worker, file-ops JSON, build orchestrator loop, SSE endpoint, R2 snapshots, real build runner, repair agent, patch operations, Ready-for-Preview Gate, requirement extraction.

---

## Available Scripts

| Script | Purpose |
|--------|---------|
| `pnpm run dev` | Start dev server (port 5173) |
| `pnpm run build` | Production build (Remix + Vite) |
| `pnpm run preview` | Build + serve locally |
| `pnpm run lint` | ESLint |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run test` | Vitest |
| `pnpm run deploy` | Build + `wrangler pages deploy` |
| `pnpm run db:push` | Apply Supabase migrations (if configured) |
| `pnpm electron:build:*` | Build desktop binaries |

---

## License

[MIT](./LICENSE) — Palmkit is open source. Based on [Bolt.diy](https://github.com/stackblitz-labs/bolt.diy) by the StackBlitz Labs community.
