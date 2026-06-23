import { getStore } from '@netlify/blobs';
import knowledge from './knowledge.json' with { type: 'json' };

const OWNER_NAME = 'Christopher Burt';
const TOP_K = 3;
const MAX_HISTORY = 8;
const RATE_LIMIT_MS = 8_000;
const MAX_MESSAGE_LEN = 1200;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

async function embedQuery(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  if (!res.ok) throw new Error('Embedding request failed');
  const data = await res.json();
  return data.data[0].embedding;
}

function retrieve(queryEmbedding) {
  return knowledge.chunks
    .map((chunk) => ({
      source: chunk.source,
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

function buildSystemPrompt(ragContext) {
  let prompt = `You are acting as ${OWNER_NAME}. You are answering questions on ${OWNER_NAME}'s website,
particularly about career, background, skills, and experience.
Stay in character — professional and engaging, as if speaking to a potential client or employer.

Answer using ONLY the retrieved context below. If the context does not contain the answer,
say honestly that you don't have that information and suggest emailing christopher.r.burt@gmail.com.

Important: ${OWNER_NAME} works full time at a company and does not do freelance, contract, consulting,
or side work. Never offer ${OWNER_NAME}'s skills or services for hire, and never imply availability for
side projects or paid engagements. If someone asks to hire ${OWNER_NAME} or requests services, politely
explain that ${OWNER_NAME} is employed full time and not available for side work, while remaining happy
to discuss background and experience.

## Retrieved context:
`;
  for (const item of ragContext) {
    prompt += `\n[${item.source}]:\n${item.text}\n`;
  }
  prompt += `\nWith this context, chat with the user as ${OWNER_NAME}. Keep replies concise (2-4 short paragraphs max).`;
  return prompt;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!knowledge.chunks?.length) {
    return json(
      { error: 'Chat knowledge is not built yet. Run npm run build:knowledge locally before deploying.' },
      503
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: 'Chat is not configured yet.' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  if (body._gotcha) return json({ ok: true, reply: '' });

  const message = String(body.message || '').trim().slice(0, MAX_MESSAGE_LEN);
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];

  if (!message) {
    return json({ error: 'Please enter a message.' }, 400);
  }

  const ip =
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  const store = getStore({ name: 'twin-chat', consistency: 'strong' });
  const rateKey = `rate:${ip}`;
  const last = await store.get(rateKey);
  const now = Date.now();
  if (last && now - Number(last) < RATE_LIMIT_MS) {
    return json({ error: 'One moment — please wait a few seconds between messages.' }, 429);
  }
  await store.set(rateKey, String(now));

  try {
    const queryEmbedding = await embedQuery(message, apiKey);
    const ragContext = retrieve(queryEmbedding);

    const messages = [
      { role: 'system', content: buildSystemPrompt(ragContext) },
      ...history.filter((m) => m?.role && m?.content),
      { role: 'user', content: message },
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI chat error:', err);
      return json({ error: 'The assistant is temporarily unavailable.' }, 502);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a reply.';

    return json({ reply });
  } catch (err) {
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

export const config = { path: '/api/chat' };
