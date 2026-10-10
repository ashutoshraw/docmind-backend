import { env } from '../config/env.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

// Fixed output size so every vector in the database is comparable —
// Atlas Vector Search requires all vectors in an index to share one dimension.
export const EMBEDDING_DIMENSIONS = 768;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// taskType tells the model HOW the text will be used, which changes the
// resulting vector slightly: a document stored for later retrieval gets
// embedded differently than a live user question searching for it. Using
// the right type for each noticeably improves match quality.
// Retry/backoff on 503/429/5xx, network failures and timeouts is handled
// by the shared fetchWithRetry helper.
const embedOne = async (text, taskType) => {
  const response = await fetchWithRetry(
    EMBEDDING_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    },
    { label: `Gemini embedding (${taskType})`, maxAttempts: 3, timeoutMs: 15000 }
  );

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