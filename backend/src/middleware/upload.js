import multer from 'multer';

// Memory storage: the file buffer lives in RAM just long enough to extract
// its text, then it's discarded — we never write uploaded files to disk,
// which keeps the server stateless and safe to redeploy anytime (important
// for Render's free tier, where the filesystem resets on every restart).
const storage = multer.memoryStorage();

const ALLOWED_MIMETYPES = ['application/pdf', 'text/plain'];
const MAX_FILE_SIZE_MB = 5;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(new Error('Only PDF and plain text files are supported'));
  }
  cb(null, true);
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

// Wraps multer so its errors are marked as client errors (4xx). Without this,
// the error handler sees a plain Error with no status and hides the real
// message behind a generic 500 response.
export const upload = {
  single: (field) => (req, res, next) => {
    multerUpload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413);
        err.message = `File is too large. The limit is ${MAX_FILE_SIZE_MB} MB.`;
      } else {
        res.status(400);
      }
      next(err);
    });
  },
};