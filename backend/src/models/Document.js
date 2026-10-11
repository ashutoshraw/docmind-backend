import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      title: { type: String, required: true, trim: true, maxlength: 100 },
    sourceType: { type: String, enum: ['pdf', 'text', 'pasted'], required: true },
    // Full extracted text kept for reference/debugging, not used directly in chat
    rawText: { type: String, required: true },
    charCount: { type: Number, required: true },
    chunkCount: { type: Number, default: 0 },
    // Lets the frontend show "processing..." while embeddings are generated,
    // since that step takes a few seconds and happens after the upload responds.
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Document', documentSchema);
