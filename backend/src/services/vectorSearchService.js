import Chunk from '../models/Chunk.js';
import mongoose from 'mongoose';

const INDEX_NAME = 'chunk_vector_index';
const TOP_K = 4; // how many chunks to retrieve per question — enough context without overwhelming the prompt

// Runs a MongoDB Atlas $vectorSearch aggregation: given a query embedding,
// finds the chunks whose embeddings are mathematically closest to it (cosine
// similarity), restricted to one document and one owner so users never see
// each other's data and don't get irrelevant chunks from their OTHER docs.
export const findRelevantChunks = async (queryEmbedding, documentId, ownerId) => {
  const results = await Chunk.aggregate([
    {
      $vectorSearch: {
        index: INDEX_NAME,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 50, // how many candidates Atlas considers before narrowing down — higher = more accurate, slower
        limit: TOP_K,
        // Both fields are declared as "filter" fields in the index, so Atlas
        // narrows to this user's chunks of THIS document BEFORE picking the
        // top K. Filtering afterwards (with $match) could leave fewer than K
        // results, or none, when a user has many documents.
        filter: {
          $and: [
            { owner: { $eq: new mongoose.Types.ObjectId(ownerId) } },
            { document: { $eq: new mongoose.Types.ObjectId(documentId) } },
          ],
        },
      },
    },
    {
      $project: {
        text: 1,
        chunkIndex: 1,
        score: { $meta: 'vectorSearchScore' }, // similarity score, useful for debugging relevance
      },
    },
  ]);

  return results;
};