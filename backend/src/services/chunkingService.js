// Splits text into overlapping chunks by character count.
// Character-based (not word/token-based) keeps this dependency-free and
// predictable — good enough for a resume project; a production system
// would chunk by token count using the model's actual tokenizer.
//
// CHUNK_SIZE: how many characters per chunk (~150-200 words)
// OVERLAP: characters repeated at the start of the next chunk, so an idea
// split across a boundary still appears whole in at least one chunk.
const CHUNK_SIZE = 1200;
const OVERLAP = 200;

// Hard cap on chunks per document. This exists specifically because the
// Gemini free tier allows only a handful of embedding requests per minute —
// capping here prevents a huge upload from blowing through the quota in one
// go. Good resume line: "capped and rate-limited ingestion to operate
// reliably within a free-tier API quota."
export const MAX_CHUNKS = 150;

export const chunkText = (text) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks = [];

  let start = 0;
  while (start < cleaned.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    chunks.push(cleaned.slice(start, end));

    if (end === cleaned.length) break;
    start = end - OVERLAP; // step back by the overlap amount before the next cut
  }

  return chunks;
};
