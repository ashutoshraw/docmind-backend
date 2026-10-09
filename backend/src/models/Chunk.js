import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, required: true },
    chunkIndex: { type: Number, required: true }, // position within the doc, for citing "chunk 3 of 12"
    // The embedding: a 768-number vector from Gemini representing this chunk's
    // meaning. This is what Atlas Vector Search compares against the question's
    // own embedding to find the most relevant chunks.
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Chunk', chunkSchema);
