import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    // Hashed refresh token so a leaked DB doesn't hand over usable tokens.
    refreshTokenHash: { type: String, select: false, default: null },
        // Guest accounts: a normal user flagged as a guest, auto-deleted by
    // MongoDB (TTL index) once guestExpiresAt passes. Both are cleared when
    // the guest signs up for a real account.
    isGuest: { type: Boolean, default: false },
    guestExpiresAt: { type: Date, default: undefined },
  },
  { timestamps: true }
);

// Runs automatically before saving — controllers never hash passwords themselves.
// TTL index: MongoDB deletes the user document when guestExpiresAt is reached.
// Regular users have no guestExpiresAt, so they are never touched.
userSchema.index({ guestExpiresAt: 1 }, { expireAfterSeconds: 0 });
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
