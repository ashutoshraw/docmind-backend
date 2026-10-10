// Turns known library errors into clean client-facing errors, so the
// controllers never need try/catch boilerplate for them.
const normalizeError = (err) => {
  // Invalid ObjectId in a URL, e.g. /documents/abc
  if (err.name === 'CastError') {
    return { status: 400, message: 'Invalid ID format' };
  }
  // Mongoose schema validation failed
  if (err.name === 'ValidationError') {
    return { status: 400, message: 'Invalid data submitted' };
  }
  // Duplicate key, e.g. an email that is already registered
  if (err.code === 11000) {
    return { status: 409, message: 'That value is already in use' };
  }
  // multer upload problems
  if (err.name === 'MulterError') {
    return err.code === 'LIMIT_FILE_SIZE'
      ? { status: 413, message: 'File is too large' }
      : { status: 400, message: 'Invalid file upload' };
  }
  return null;
};

// Catches anything passed to next(err) or thrown inside an async route
// wrapped with asyncHandler, so controllers never need try/catch boilerplate.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const known = normalizeError(err);

  // Honor, in order: a mapped library error, err.statusCode, or the status a
  // controller set with res.status(...) before throwing. Otherwise it's a
  // genuine unexpected failure, which is a 500.
  const status =
    known?.status ??
    err.statusCode ??
    (res.statusCode >= 400 ? res.statusCode : 500);

  if (status >= 500) {
    // Unexpected: full details go to OUR logs only
    console.error(`[${req.method} ${req.originalUrl}]`, err.stack);
  } else {
    // Expected client error (wrong password, missing token...): one quiet line, no stack
    console.warn(`[${status}] ${req.method} ${req.originalUrl} - ${known?.message ?? err.message}`);
  }

  res.status(status).json({
    // 4xx messages are written by our own code, so they're safe to show.
    // 5xx messages can contain hostnames, paths or upstream response bodies,
    // so the client only ever sees a generic line.
    message:
      status >= 500
        ? 'Something went wrong on our end. Please try again.'
        : known?.message ?? err.message,
    // Stack only outside production
    stack: process.env.NODE_ENV === 'production' || status < 500 ? undefined : err.stack,
  });
};

export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

// Wraps an async controller so a rejected promise is forwarded to errorHandler
// instead of crashing the process or hanging the request.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);