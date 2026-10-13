import User from '../models/User.js';
import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import Message from '../models/Message.js';

// Expired guest users are deleted by MongoDB's TTL index, but their documents,
// chunks and messages are not. This finds data whose owner no longer exists
// and removes it, so expired guests don't fill the free Atlas storage.
export const cleanupOrphanedData = async () => {
  const [docOwners, chunkOwners, messageOwners] = await Promise.all([
    Document.distinct('owner'),
    Chunk.distinct('owner'),
    Message.distinct('owner'),
  ]);

  const ownerIds = [
    ...new Set([...docOwners, ...chunkOwners, ...messageOwners].map(String)),
  ];
  if (ownerIds.length === 0) return { chunks: 0, messages: 0, documents: 0 };

  const existing = new Set(
    (await User.distinct('_id', { _id: { $in: ownerIds } })).map(String)
  );
  const orphanIds = ownerIds.filter((id) => !existing.has(id));
  if (orphanIds.length === 0) return { chunks: 0, messages: 0, documents: 0 };

  const chunks = await Chunk.deleteMany({ owner: { $in: orphanIds } });
  const messages = await Message.deleteMany({ owner: { $in: orphanIds } });
  const documents = await Document.deleteMany({ owner: { $in: orphanIds } });

  return {
    chunks: chunks.deletedCount,
    messages: messages.deletedCount,
    documents: documents.deletedCount,
  };
};