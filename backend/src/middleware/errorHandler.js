// Catches anything passed to next(err) or thrown inside an async route
// wrapped with asyncHandler, so controllers never need try/catch boilerplate.
export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error',
    // Stack traces only in dev — never leak internals to users in production.
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

export const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

// Wraps an async controller so a rejected promise is forwarded to errorHandler
// instead of crashing the process or hanging the request.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
