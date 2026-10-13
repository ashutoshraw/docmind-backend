import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake all four models so no real database is needed.
vi.mock('../src/models/User.js', () => ({ default: { distinct: vi.fn() } }));
vi.mock('../src/models/Document.js', () => ({
  default: { distinct: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('../src/models/Chunk.js', () => ({
  default: { distinct: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('../src/models/Message.js', () => ({
  default: { distinct: vi.fn(), deleteMany: vi.fn() },
}));

import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import Chunk from '../src/models/Chunk.js';
import Message from '../src/models/Message.js';
import { cleanupOrphanedData } from '../src/utils/cleanupOrphans.js';

describe('cleanupOrphanedData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Document.deleteMany.mockResolvedValue({ deletedCount: 2 });
    Chunk.deleteMany.mockResolvedValue({ deletedCount: 5 });
    Message.deleteMany.mockResolvedValue({ deletedCount: 1 });
  });

  it('does nothing when no data exists', async () => {
    Document.distinct.mockResolvedValue([]);
    Chunk.distinct.mockResolvedValue([]);
    Message.distinct.mockResolvedValue([]);

    const result = await cleanupOrphanedData();

    expect(result).toEqual({ chunks: 0, messages: 0, documents: 0 });
    expect(Document.deleteMany).not.toHaveBeenCalled();
  });

  it('does not delete anything when every owner still exists', async () => {
    Document.distinct.mockResolvedValue(['u1', 'u2']);
    Chunk.distinct.mockResolvedValue(['u1']);
    Message.distinct.mockResolvedValue(['u2']);
    User.distinct.mockResolvedValue(['u1', 'u2']);

    const result = await cleanupOrphanedData();

    expect(result).toEqual({ chunks: 0, messages: 0, documents: 0 });
    expect(Document.deleteMany).not.toHaveBeenCalled();
    expect(Chunk.deleteMany).not.toHaveBeenCalled();
    expect(Message.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes data only for owners whose user no longer exists', async () => {
    Document.distinct.mockResolvedValue(['u1', 'gone']);
    Chunk.distinct.mockResolvedValue(['u1', 'gone']);
    Message.distinct.mockResolvedValue(['gone']);
    User.distinct.mockResolvedValue(['u1']); // only u1 still has a user

    const result = await cleanupOrphanedData();

    const orphanFilter = { owner: { $in: ['gone'] } };
    expect(Chunk.deleteMany).toHaveBeenCalledWith(orphanFilter);
    expect(Message.deleteMany).toHaveBeenCalledWith(orphanFilter);
    expect(Document.deleteMany).toHaveBeenCalledWith(orphanFilter);
    expect(result).toEqual({ chunks: 5, messages: 1, documents: 2 });
  });

  it('checks each owner only once even if they appear in several collections', async () => {
    Document.distinct.mockResolvedValue(['u1']);
    Chunk.distinct.mockResolvedValue(['u1']);
    Message.distinct.mockResolvedValue(['u1']);
    User.distinct.mockResolvedValue(['u1']);

    await cleanupOrphanedData();

    expect(User.distinct).toHaveBeenCalledWith('_id', { _id: { $in: ['u1'] } });
  });
});