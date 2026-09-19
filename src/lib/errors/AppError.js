export class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.statusCode = options.statusCode ?? 400;
    this.details = options.details ?? null;

    Error.captureStackTrace(this, this.constructor);
  }
}
