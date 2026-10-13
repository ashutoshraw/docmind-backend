import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake everything the controller imports that needs a database, secrets or hashing.
vi.mock('../src/models/User.js', () => ({
  default: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
}));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-refresh-token') },
}));
vi.mock('../src/config/env.js', () => ({ env: {} }));
vi.mock('../src/utils/generateTokens.js', () => ({
  generateAccessToken: () => 'new-access-token',
  generateRefreshToken: () => 'new-refresh-token',
  cookieOptions: {},
}));
vi.mock('../src/middleware/errorHandler.js', () => ({
  asyncHandler: (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next),
}));

import User from '../src/models/User.js';
import { upgradeGuest } from '../src/controllers/authController.js';

const makeGuest = () => ({
  _id: 'user1',
  name: 'Guest',
  email: 'guest-abc@guest.docmind.local',
  isGuest: true,
  guestExpiresAt: new Date(),
  save: vi.fn().mockResolvedValue(undefined),
});

const run = async (body) => {
  const req = { userId: 'user1', body };
  const res = { status: vi.fn(), cookie: vi.fn(), json: vi.fn() };
  const next = vi.fn();
  await upgradeGuest(req, res, next);
  return { res, next };
};

describe('upgradeGuest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts the SAME user into a real account, so documents stay attached', async () => {
    const guest = makeGuest();
    User.findById.mockResolvedValue(guest);
    User.findOne.mockResolvedValue(null);

    const { res } = await run({ name: 'Ashu', email: '  Ashu@Example.COM ', password: 'secret123' });

    expect(guest._id).toBe('user1'); // same id, so owner references still match
    expect(User.create).not.toHaveBeenCalled(); // no new user is created
    expect(guest.isGuest).toBe(false);
    expect(guest.guestExpiresAt).toBeUndefined(); // TTL index no longer applies
    expect(guest.email).toBe('ashu@example.com'); // trimmed and lowercased
    expect(guest.name).toBe('Ashu');
    expect(guest.password).toBe('secret123'); // hashed by the model's pre-save hook
    expect(guest.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'new-access-token',
        user: expect.objectContaining({ id: 'user1', isGuest: false }),
      })
    );
  });

  it('rejects an account that is not a guest with 400', async () => {
    const user = { ...makeGuest(), isGuest: false };
    User.findById.mockResolvedValue(user);

    const { res, next } = await run({ name: 'A', email: 'a@b.com', password: 'secret123' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(user.save).not.toHaveBeenCalled();
  });

  it('rejects an email that is already registered with 409', async () => {
    const guest = makeGuest();
    User.findById.mockResolvedValue(guest);
    User.findOne.mockResolvedValue({ _id: 'someone-else' });

    const { res, next } = await run({ name: 'A', email: 'taken@b.com', password: 'secret123' });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(guest.isGuest).toBe(true); // guest is left untouched
    expect(guest.save).not.toHaveBeenCalled();
  });
});