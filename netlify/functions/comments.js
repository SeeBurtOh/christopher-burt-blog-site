import { getStore } from '@netlify/blobs';
import leoProfanity from 'leo-profanity';

// Allow only safe characters in a post slug (path-segment-ish).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/i;

const NAME_MAX = 60;
const MESSAGE_MAX = 2000;
const RATE_LIMIT_MS = 30_000; // 30s between posts per IP

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });

function sanitizeName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
}
function sanitizeMessage(s) {
  return String(s || '').trim().slice(0, MESSAGE_MAX);
}

export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get('post');

  if (!slug || !SLUG_RE.test(slug)) {
    return json({ error: 'Invalid or missing post slug.' }, 400);
  }

  const store = getStore({ name: 'comments', consistency: 'strong' });
  const key = `post:${slug}`;

  // --- GET: list comments for a post ---
  if (req.method === 'GET') {
    const comments = (await store.get(key, { type: 'json' })) || [];
    return json({ comments });
  }

  // --- POST: add a new comment ---
  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request body.' }, 400);
    }

    // Honeypot: bots fill hidden fields, humans don't.
    if (body.website) {
      // Pretend it worked so bots don't probe.
      return json({ ok: true });
    }

    const name = sanitizeName(body.name);
    const message = sanitizeMessage(body.message);

    if (!name || !message) {
      return json({ error: 'Please include both your name and a comment.' }, 400);
    }
    if (name.length < 2) {
      return json({ error: 'Name is too short.' }, 400);
    }
    if (message.length < 3) {
      return json({ error: 'Comment is too short.' }, 400);
    }

    // Profanity filter (server-side; cannot be bypassed by disabling JS).
    if (leoProfanity.check(name) || leoProfanity.check(message)) {
      return json(
        { error: "Let's keep it respectful — please rephrase without profanity." },
        400
      );
    }

    // Per-IP rate limit.
    const ip =
      req.headers.get('x-nf-client-connection-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    const rateKey = `rate:${ip}`;
    const last = await store.get(rateKey);
    const now = Date.now();
    if (last && now - Number(last) < RATE_LIMIT_MS) {
      return json(
        { error: 'You posted recently — give it a moment before commenting again.' },
        429
      );
    }
    await store.set(rateKey, String(now));

    // Append comment.
    const comments = (await store.get(key, { type: 'json' })) || [];
    const comment = {
      id: crypto.randomUUID(),
      name,
      message,
      createdAt: new Date().toISOString()
    };
    comments.push(comment);
    await store.setJSON(key, comments);

    return json({ ok: true, comment });
  }

  return json({ error: 'Method not allowed.' }, 405);
};

export const config = { path: '/api/comments' };
