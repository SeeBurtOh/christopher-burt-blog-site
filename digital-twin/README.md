# Copy your LinkedIn PDF export here before building:
#   digital-twin/cb_me/linkedin.pdf
#
# Update knowledge index (local):
#   OPENAI_API_KEY=sk-... npm run build:knowledge
#
# Netlify rebuilds the knowledge index on every deploy via the build command in
# netlify.toml (`npm run build:knowledge`), as long as OPENAI_API_KEY is set in
# the site's env vars. So committing an edit to summary.txt / linkedin.pdf is
# enough — the index regenerates automatically when the site deploys.
# If the rebuild is skipped (no key) or fails (site fetch hiccup), the deploy
# falls back to the committed netlify/functions/knowledge.json.
