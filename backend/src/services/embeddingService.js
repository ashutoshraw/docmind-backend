import { env } from '../config/env.js';

const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`;

// Fixed output size so every vector in the database is comparable —
// Atlas Vector Search requires all vectors in an index to share one dimension.
export const EMBEDDING_DIMENSIONS = 768;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Same resilience pattern as aiService: 503 (overloaded) and 429 (rate
// limited) are transient and worth retrying with backoff; anything else
// fails immediately since retrying won't help.
const RETRYABLE_STATUSES = [503, 429];
const MAX_RETRIES = 3;

// taskType tells the model HOW the text will be used, which changes the
// resulting vector slightly: a document stored for later retrieval gets
// embedded differently than a live user question searching for it. Using
// the right type for each noticeably improves match quality.
const embedOne = async (text, taskType, attempt = 1) => {
  const response = await fetch(EMBEDDING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();

    if (RETRYABLE_STATUSES.includes(response.status) && attempt < MAX_RETRIES) {
      const delayMs = 1000 * 2 ** (attempt - 1);
      console.warn(
        `Gemini embedding returned ${response.status}, retrying in ${delayMs}ms (attempt ${attempt}/${MAX_RETRIES})`
      );
      await sleep(delayMs);
      return embedOne(text, taskType, attempt + 1);
    }

    throw new Error(`Gemini embedding request failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return data.embedding.values; // array of 768 numbers
};

export const embedDocumentChunk = (text) => embedOne(text, 'RETRIEVAL_DOCUMENT');
export const embedQuery = (text) => embedOne(text, 'RETRIEVAL_QUERY');

// Embeds many chunks while respecting the free-tier rate limit.
// Instead of firing all requests at once (which gets us 429 rate-limited
// almost immediately on the free tier), we process a small batch, pause,
// then continue. BATCH_SIZE and PAUSE_MS are tuned conservatively — slower,
// but reliable. This function is the actual throughput bottleneck of the
// whole ingestion pipeline, worth mentioning in interviews.
const BATCH_SIZE = 3;
const PAUSE_MS = 1500;

export const embedChunksInBatches = async (chunks, onProgress) => {
  const embeddings = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((chunk) => embedDocumentChunk(chunk))
    );
    embeddings.push(...batchResults);

    if (onProgress) onProgress(embeddings.length, chunks.length);

    const isLastBatch = i + BATCH_SIZE >= chunks.length;
    if (!isLastBatch) await sleep(PAUSE_MS);
  }

  return embeddings;
};
