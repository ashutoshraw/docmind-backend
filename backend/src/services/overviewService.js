import Chunk from '../models/Chunk.js';

// Questions about the whole document, where vector search can't help
// because the question has no specific topic to match against
const OVERVIEW_PATTERN =
  /\b(summar(y|ize|ise)|overview|key points?|main (points?|ideas?|topics?)|tl;?dr|what is (this|the) (document|doc|file|text) about|about this (document|doc|file)|(important|key) (dates?|names?|numbers?|details?|facts?|topics?))\b/i;

export const isOverviewQuestion = (question) => OVERVIEW_PATTERN.test(question);

// Picks up to `limit` chunks evenly spaced across the document, so the
// answer covers the beginning, middle and end instead of one random spot
export const getOverviewChunks = async (documentId, owner, limit = 8) => {
  const all = await Chunk.find({ document: documentId, owner })
    .select('text chunkIndex')
    .sort({ chunkIndex: 1 })
    .lean();

  if (all.length <= limit) return all;

  const step = (all.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, i) => all[Math.round(i * step)]);
};