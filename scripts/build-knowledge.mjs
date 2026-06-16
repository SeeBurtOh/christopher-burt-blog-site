#!/usr/bin/env node
/**
 * Build the digital-twin knowledge index for the Netlify chat function.
 * Run when cb_me/ or website content changes:
 *   OPENAI_API_KEY=sk-... npm run build:knowledge
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const CB_ME = path.join(root, 'digital-twin', 'cb_me');
const OUT = path.join(root, 'netlify', 'functions', 'knowledge.json');
const WEBSITE_URL = 'https://www.christopherburt.dev';

function chunkText(text, chunkSize = 400, overlap = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const step = chunkSize - overlap;
  const chunks = [];
  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

async function fetchWebsiteText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CBBotKnowledgeBuilder/1.0' },
  });
  if (!res.ok) throw new Error(`Website fetch failed: ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadDocuments() {
  const documents = {};

  documents.summary = await fs.readFile(path.join(CB_ME, 'summary.txt'), 'utf8');

  const pdfPath = path.join(CB_ME, 'linkedin.pdf');
  try {
    const buffer = await fs.readFile(pdfPath);
    const parsed = await pdf(buffer);
    documents.linkedin = parsed.text || '';
  } catch {
    console.warn('Warning: linkedin.pdf not found — skipping LinkedIn source.');
    documents.linkedin = '';
  }

  console.log('Fetching website...');
  documents.website = await fetchWebsiteText(WEBSITE_URL);

  return documents;
}

async function embedTexts(texts, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings failed: ${err}`);
  }
  const data = await res.json();
  return data.data.map((item) => item.embedding);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Set OPENAI_API_KEY before running build:knowledge');
  }

  const documents = await loadDocuments();
  const chunks = [];

  for (const [source, content] of Object.entries(documents)) {
    if (!content?.trim()) continue;
    for (const [i, text] of chunkText(content).entries()) {
      chunks.push({ id: `${source}_${i}`, source, text });
    }
  }

  if (!chunks.length) throw new Error('No chunks created — check digital-twin/cb_me/');

  console.log(`Embedding ${chunks.length} chunks...`);
  const embeddings = await embedTexts(
    chunks.map((c) => c.text),
    apiKey
  );

  const knowledge = {
    builtAt: new Date().toISOString(),
    chunkCount: chunks.length,
    chunks: chunks.map((c, i) => ({ ...c, embedding: embeddings[i] })),
  };

  await fs.writeFile(OUT, JSON.stringify(knowledge));
  console.log(`Wrote ${OUT} (${chunks.length} chunks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
