import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import { extractText } from '../services/extractionService.js';
import { chunkText } from '../services/chunkingService.js';
import { embedChunksInBatches } from '../services/embeddingService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Runs after the HTTP response has already been sent. Any error here gets
// caught and written onto the document as status "failed", so the frontend
// can show "processing failed, try again" instead of a silently stuck doc.
const processDocumentAsync = async (documentId, rawText) => {
  try {
    const chunks = chunkText(rawText);

    if (chunks.length === 0) {
      await Document.findByIdAndUpdate(documentId, {
        status: 'failed',
        errorMessage: 'No readable text found in this document',
      });
      return;
    }

    const embeddings = await embedChunksInBatches(chunks);

    const chunkDocs = chunks.map((text, i) => ({
      document: documentId,
      owner: null, // filled in below once we know it
      text,
      chunkIndex: i,
      embedding: embeddings[i],
    }));

    const doc = await Document.findById(documentId);
    chunkDocs.forEach((c) => (c.owner = doc.owner));

    await Chunk.insertMany(chunkDocs);

    doc.status = 'ready';
    doc.chunkCount = chunkDocs.length;
    await doc.save();
  } catch (err) {
    console.error(`Processing failed for document ${documentId}:`, err.message);
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      errorMessage: 'Something went wrong while processing this document',
    });
  }
};

// POST /api/documents  (multipart file OR { title, text } JSON body)
export const uploadDocument = asyncHandler(async (req, res) => {
  let rawText;
  let sourceType;
  let title = req.body.title?.trim();

  if (req.file) {
    rawText = await extractText(req.file.buffer, req.file.mimetype);
    sourceType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'text';
    if (!title) title = req.file.originalname;
  } else if (req.body.text?.trim()) {
    rawText = req.body.text.trim();
    sourceType = 'pasted';
    if (!title) title = rawText.slice(0, 50) + (rawText.length > 50 ? '...' : '');
  } else {
    res.status(400);
    throw new Error('Provide either a file upload or pasted text');
  }

  if (rawText.trim().length < 50) {
    res.status(400);
    throw new Error('Document text is too short to be useful (minimum ~50 characters)');
  }

  const document = await Document.create({
    owner: req.userId,
    title,
    sourceType,
    rawText,
    charCount: rawText.length,
    status: 'processing',
  });

  // Fire-and-forget: deliberately not awaited, so the response below goes
  // out immediately while embedding continues in the background.
  processDocumentAsync(document._id, rawText);

  res.status(202).json({
    message: 'Document received and is being processed',
    document: {
      id: document._id,
      title: document.title,
      status: document.status,
      charCount: document.charCount,
    },
  });
});

// GET /api/documents — list the current user's documents
export const listDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ owner: req.userId })
    .select('title sourceType status charCount chunkCount createdAt errorMessage')
    .sort({ createdAt: -1 });
  res.json(documents);
});

// GET /api/documents/:id — single document detail (used for polling status)
export const getDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ _id: req.params.id, owner: req.userId });
  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }
  res.json(document);
});

// DELETE /api/documents/:id — removes the document and all its chunks
export const deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({ _id: req.params.id, owner: req.userId });
  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  await Chunk.deleteMany({ document: document._id });
  await document.deleteOne();

  res.json({ message: 'Document deleted' });
});
