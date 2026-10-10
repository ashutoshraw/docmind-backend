import { env } from '../config/env.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

// Stable aliases Google maintains so we don't need manual updates every time
// a specific dated model version gets deprecated. flash-lite is the lighter,
// cheaper model — on the free tier it tends to see less "high demand" 503
// congestion than the full flash model, so we try it first and fall back to
// flash only if lite itself is briefly overloaded.
const PRIMARY_MODEL = 'gemini-flash-lite-latest';
const FALLBACK_MODEL = 'gemini-flash-latest';

const urlFor = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// This is the core of "grounded" AI: instead of letting Gemini answer from
// its general training knowledge, we explicitly hand it only the retrieved
// chunks and instruct it to answer ONLY from them. If the answer isn't in
// the provided context, it's told to say so rather than guess — this is
// what stops a RAG app from confidently making things up.
const buildPrompt = (question, contextChunks) => {
  const context = contextChunks
    .map((c, i) => `[Chunk ${i + 1}]\n${c.text}`)
    .join('\n\n');

  return `You are a helpful assistant answering questions about a specific document.
Answer the question using ONLY the context chunks below. Do not use any outside knowledge.
If the answer cannot be found in the context, say "I couldn't find that in the document" — do not guess or make something up.
When you use information from a chunk, mention which chunk number it came from, like (Chunk 2).

CONTEXT:
${context}

QUESTION:
${question}

ANSWER:`;
};

// Retries (503/429/5xx, network failures, timeouts) are handled by the
// shared fetchWithRetry helper. The API key travels in a header rather than
// the URL so it can't leak into error messages or logs.
const callGemini = async (prompt, model) => {
  const response = await fetchWithRetry(
    urlFor(model),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2, // low temperature: favors sticking to facts over creativity, important for a Q&A tool
          maxOutputTokens: 1024,
        },
      }),
    },
    { label: `Gemini ${model}`, maxAttempts: 3, timeoutMs: 20000 }
  );

  return response.json();
};

const extractText = (data) => data.candidates?.[0]?.content?.parts?.[0]?.text;

export const generateAnswer = async (question, contextChunks) => {
  const prompt = buildPrompt(question, contextChunks);

  let data;
  try {
    data = await callGemini(prompt, PRIMARY_MODEL);
  } catch (primaryErr) {
    // Primary model exhausted its own retries — try the fallback model
    // once before giving up entirely. Two different models failing at the
    // same moment is rare.
    console.warn(`Primary model failed, trying fallback: ${primaryErr.message}`);
    data = await callGemini(prompt, FALLBACK_MODEL);
  }

  const text = extractText(data);
  if (!text) {
    throw new Error('Gemini returned no answer content');
  }

  return text.trim();
};