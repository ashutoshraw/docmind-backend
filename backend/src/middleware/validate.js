import { validationResult } from 'express-validator';

// Runs after the body() checks declared in a route and turns their results
// into one clean 400 response instead of each controller checking manually.
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};
