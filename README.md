# Christopher Burt — Personal Site

Personal site for Christopher Burt, AI Automation Engineer. Static HTML/CSS/JS
with two dynamic Netlify Functions: a **Digital Twin** chat assistant (a
retrieval-augmented AI that answers questions as Christopher) and a blog
comments endpoint.

## Files
- `index.html` — homepage (Home / About / Digital Twin / Contact sections)
- `styles.css` — design system, layout, animations, blog and comment styles
- `script.js` — nav highlighting, scroll reveals, neural-network canvas, contact form
- `assets/comments.js` — frontend for the blog comments widget
- `blog/` — blog index and post pages
- `digital-twin/cb_me/` — source material for the twin (`summary.txt`, `linkedin.pdf`)
- `scripts/build-knowledge.mjs` — builds the twin's embedded knowledge index
- `netlify/functions/chat.js` — Digital Twin RAG endpoint (`/api/chat`)
- `netlify/functions/knowledge.json` — prebuilt, embedded knowledge index the chat function reads
- `netlify/functions/comments.js` — blog comments endpoint (`/api/comments`)
- `netlify.toml` — Netlify build/functions config
- `package.json` — declares Function dependencies (`@netlify/blobs`, `leo-profanity`, `pdf-parse`)

## Digital Twin

The homepage "Digital Twin" console lets visitors chat with an AI that answers
as Christopher — about his background, skills, and experience. It's a small,
self-contained **retrieval-augmented generation (RAG)** pipeline with no
external vector database or framework: retrieval runs in-memory inside the
Netlify Function.

### Architecture

```
Browser widget (index.html)
   │  POST /api/chat  { message, history }
   ▼
Netlify Function (netlify/functions/chat.js)
   ├─ 1. Embed the question      → OpenAI text-embedding-3-small (1536-dim)
   ├─ 2. Retrieve top-3 chunks   → cosine similarity over knowledge.json
   ├─ 3. Build a persona prompt  → system prompt + retrieved context + history
   └─ 4. Generate the reply      → OpenAI gpt-4o-mini  →  { reply }
```

### Components

**Frontend — chat widget (`index.html`)**
The `#twin` console posts `{ message, history }` to `/api/chat` and renders the
streamed-in reply. It keeps a short rolling conversation history client-side so
follow-up questions have context, and includes a hidden honeypot field for bot
filtering.

**Backend — RAG endpoint (`netlify/functions/chat.js`)**
A Netlify Function (v2) mounted at `/api/chat`. For each message it:
1. **Embeds the query** with OpenAI `text-embedding-3-small`.
2. **Retrieves** the top 3 most relevant knowledge chunks by cosine similarity —
   the embeddings are precomputed and shipped in `knowledge.json`, so retrieval
   is a fast in-memory dot-product, no vector DB required.
3. **Composes a system prompt** that puts the model in character as Christopher,
   injects the retrieved context, and enforces guardrails (answer only from
   context; if unknown, say so and point to email; never offer freelance/for-hire
   work since Christopher is employed full time; keep replies concise).
4. **Generates** the reply with OpenAI `gpt-4o-mini`, passing the last 8 turns of
   conversation history for continuity.

**Knowledge index (`scripts/build-knowledge.mjs` → `knowledge.json`)**
An offline build step that turns Christopher's source material into the embedded
index the function reads. It:
- Loads `digital-twin/cb_me/summary.txt` and parses `digital-twin/cb_me/linkedin.pdf`
  (via `pdf-parse`), and scrapes the live site's text as a third source.
- Chunks each document (~400 words, 50-word overlap).
- Batch-embeds every chunk with `text-embedding-3-small`.
- Writes `netlify/functions/knowledge.json` (`{ builtAt, chunkCount, chunks[] }`,
  each chunk carrying its `source`, `text`, and `embedding`).

**Storage & abuse controls**
Per-IP rate limiting (one message every ~8s) is tracked in **Netlify Blobs**;
requests are also capped at 1200 characters and the honeypot short-circuits bots.

### Updating the twin's knowledge

Edit `digital-twin/cb_me/summary.txt` (or replace `linkedin.pdf`), then rebuild:

```bash
OPENAI_API_KEY=sk-... npm run build:knowledge
```

You don't have to run this by hand for a deploy: `netlify.toml`'s build command
runs `npm run build:knowledge` on every deploy, so committing an edit to the
source files regenerates the index automatically. If the rebuild is skipped
(no `OPENAI_API_KEY`) or fails (e.g. a site-fetch hiccup), the deploy still
succeeds and falls back to the committed `knowledge.json`.

**Required env var:** `OPENAI_API_KEY` must be set in the Netlify site settings
for the chat function to run (and for the deploy-time index rebuild).

## Running locally
For the static pages, a plain server is fine:

```bash
cd /Users/cburto/projects/christopher-burt-site
python3 -m http.server 8080
# then visit http://localhost:8080
```

To run the Functions locally (same `/api/chat` and `/api/comments` routes as
production), install the Netlify CLI and run:

```bash
npm install
export OPENAI_API_KEY=sk-...   # needed for the Digital Twin chat
npx netlify dev
# then visit http://localhost:8888
```

## Comments

- Storage: Netlify Blobs (no external service, no signup).
- Profanity filter: `leo-profanity`, enforced server-side.
- Honeypot field + per-IP rate limiting (30s between submissions).
- Anonymous — commenters supply only a name and a message.

## Deployment

This site uses Netlify Git-based deployment because the Functions require
`npm install` (and the twin's knowledge-index build) at build time. Pushing to
`main` triggers an auto-deploy.

One-time setup is documented in the deployment notes; subsequent updates are:

```bash
git add -A
git commit -m "your change"
git push
```

## Contact form (Formspree)

The contact form on the homepage submits to Formspree
(`https://formspree.io/f/xrejnyep`). Submissions land at
`christopher.r.burt@gmail.com`.
