/**
 * Application-specific error with a stable error code,
 * HTTP status code, and optional additional details.
 */
export default class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message);

    // Identify this error as an AppError instance.
    this.name = "AppError";

    // Provide a machine-readable code for error handling.
    this.code = code;

    // Default to HTTP 400 when no status code is provided.
    this.statusCode = options.statusCode ?? 400;

    // Store optional contextual information about the error.
    this.details = options.details ?? null;

    // Exclude the constructor call from the stack trace in V8 environments.
    Error.captureStackTrace(this, this.constructor);
  }
}
