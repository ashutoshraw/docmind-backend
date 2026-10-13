import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake the database models and the async wrapper, so no real DB is needed.
vi.mock('../src/models/User.js', () => ({ default: { findById: vi.fn() } }));
vi.mock('../src/models/Document.js', () => ({ default: { countDocuments: vi.fn() } }));
vi.mock('../src/middleware/errorHandler.js', () => ({
  asyncHandler: (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

import User from '../src/models/User.js';
import Document from '../src/models/Document.js';
import { enforceGuestLimits } from '../src/middleware/guestLimits.js';

const mockUser = (user) =>
  User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });

const run = async (contentLength = '1000') => {
  const req = { userId: 'user1', headers: { 'content-length': contentLength } };
  const res = { status: vi.fn() };
  const next = vi.fn();
  await enforceGuestLimits(req, res, next);
  return { res, next };
};

describe('enforceGuestLimits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets regular users through without checking limits', async () => {
    mockUser({ isGuest: false });
    const { next } = await run(String(50 * 1024 * 1024));
    expect(next).toHaveBeenCalledWith();
    expect(Document.countDocuments).not.toHaveBeenCalled();
  });

  it('rejects a guest upload larger than 3 MB with 413', async () => {
    mockUser({ isGuest: true });
    const { res, next } = await run(String(4 * 1024 * 1024));
    expect(res.status).toHaveBeenCalledWith(413);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('rejects a guest who already has 3 documents with 403', async () => {
    mockUser({ isGuest: true });
    Document.countDocuments.mockResolvedValue(3);
    const { res, next } = await run();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('allows a guest with fewer than 3 documents and a small file', async () => {
    mockUser({ isGuest: true });
    Document.countDocuments.mockResolvedValue(2);
    const { next } = await run();
    expect(next).toHaveBeenCalledWith();
  });
});