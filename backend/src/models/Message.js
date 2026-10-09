import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    // Which chunks were used to answer, so the frontend can show "sources"
    // and so we have a record for debugging bad answers later.
    sourceChunks: [
      {
        chunkIndex: Number,
        text: String,
        score: Number,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
