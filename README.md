# Christopher Burt — Personal Site

Personal site for Christopher Burt, AI Automation Engineer. Static HTML/CSS/JS
with one dynamic Netlify Function for blog comments.

## Files
- `index.html` — homepage (Home / About / Blog / Contact sections)
- `styles.css` — design system, layout, animations, blog and comment styles
- `script.js` — nav highlighting, scroll reveals, neural-network canvas, contact form
- `assets/comments.js` — frontend for the blog comments widget
- `blog/` — blog index and post pages
- `netlify/functions/comments.js` — serverless endpoint (`/api/comments`) handling comment fetch and submission
- `netlify.toml` — Netlify build/functions config
- `package.json` — declares Function dependencies (`@netlify/blobs`, `leo-profanity`)

## Running locally
For the static pages, a plain server is fine:

```bash
cd /Users/cburto/projects/christopher-burt-site
python3 -m http.server 8080
# then visit http://localhost:8080
```

To run the comments function locally (with the same `/api/comments` route the
production site uses), install the Netlify CLI and run:

```bash
npm install
npx netlify dev
# then visit http://localhost:8888
```

## Comments

- Storage: Netlify Blobs (no external service, no signup).
- Profanity filter: `leo-profanity`, enforced server-side.
- Honeypot field + per-IP rate limiting (30s between submissions).
- Anonymous — commenters supply only a name and a message.

## Deployment

This site uses Netlify Git-based deployment because the comments function
requires `npm install` at build time. Pushing to `main` triggers an auto-deploy.

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
