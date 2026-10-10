import Document from '../models/Document.js';
import Message from '../models/Message.js';
import { embedQuery } from '../services/embeddingService.js';
import { findRelevantChunks } from '../services/vectorSearchService.js';
import { isOverviewQuestion, getOverviewChunks } from '../services/overviewService.js';
import { generateAnswer } from '../services/aiService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// POST /api/chat/:documentId  { question: string }
export const askQuestion = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { question } = req.body;

  if (!question?.trim()) {
    res.status(400);
    throw new Error('Question is required');
  }

  const document = await Document.findOne({ _id: documentId, owner: req.userId });
  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }
  if (document.status !== 'ready') {
    res.status(409);
    throw new Error(`Document is not ready yet (status: ${document.status})`);
  }

  // Retrieval: pick the strategy based on the kind of question.
  // - Overview questions ("summarize", "key points") have no specific topic,
  //   so vector search would return random chunks. Instead we sample chunks
  //   evenly across the whole document. These have no similarity score.
  // - Specific questions use embeddings + Atlas Vector Search as before.
  let relevantChunks;
  if (isOverviewQuestion(question)) {
    const sampled = await getOverviewChunks(documentId, req.userId);
    relevantChunks = sampled.map((c) => ({ ...c, score: null }));
  } else {
    // taskType "RETRIEVAL_QUERY" differs from "RETRIEVAL_DOCUMENT" on purpose:
    // a question and its answer phrase things differently, and the model
    // embeds each role slightly differently to improve match quality.
    const queryEmbedding = await embedQuery(question);
    relevantChunks = await findRelevantChunks(queryEmbedding, documentId, req.userId);
  }

  if (relevantChunks.length === 0) {
    const fallbackAnswer = "I couldn't find anything relevant to that question in this document.";
    const message = await Message.create({
      document: documentId,
      owner: req.userId,
      question,
      answer: fallbackAnswer,
      sourceChunks: [],
    });
    return res.json({ answer: fallbackAnswer, sources: [], messageId: message._id });
  }

  // Generation: Gemini answers using ONLY the retrieved chunks
  const answer = await generateAnswer(question, relevantChunks);

  const message = await Message.create({
    document: documentId,
    owner: req.userId,
    question,
    answer,
    sourceChunks: relevantChunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      text: c.text,
      score: c.score,
    })),
  });

  res.json({
    answer,
    sources: relevantChunks.map((c) => ({ chunkIndex: c.chunkIndex, score: c.score })),
    messageId: message._id,
  });
});

// GET /api/chat/:documentId/history
export const getChatHistory = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const document = await Document.findOne({ _id: documentId, owner: req.userId });
  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  const messages = await Message.find({ document: documentId, owner: req.userId })
    .sort({ createdAt: 1 })
    .select('question answer sourceChunks createdAt');

  res.json(messages);
});