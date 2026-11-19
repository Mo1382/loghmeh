import { ERROR_CODES } from "@/constants/error-codes";
import { handleError } from "@/lib/errors/handle-error";

/**
 * Create a predictable success response for a Server Action.
 *
 * Keep `data` limited to values that Next.js can serialize. In particular,
 * return plain DTOs instead of Mongoose documents or internal service objects.
 */
export function createActionSuccessResponse(data = null, message = null) {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Add string messages to a field-error collection without exposing arbitrary
 * values from an internal error object.
 */
function appendMessages(target, key, messages) {
  if (!Array.isArray(messages)) {
    return;
  }

  const safeMessages = messages.filter(
    (message) => typeof message === "string" && message.length > 0
  );

  if (safeMessages.length === 0) {
    return;
  }

  target[key] = [...(target[key] ?? []), ...safeMessages];
}

/**
 * Collect errors from the tree returned by Zod's treeifyError().
 *
 * Field paths are represented as dot-separated strings, which can be mapped
 * to form controls by the Client Component. Root-level issues become
 * form-level errors.
 */
function collectZodTreeErrors(node, path, fieldErrors, formErrors) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return;
  }

  if (Array.isArray(node.errors)) {
    if (path.length === 0) {
      formErrors.push(
        ...node.errors.filter(
          (message) => typeof message === "string" && message.length > 0
        )
      );
    } else {
      appendMessages(fieldErrors, path.join("."), node.errors);
    }
  }

  if (
    node.properties &&
    typeof node.properties === "object" &&
    !Array.isArray(node.properties)
  ) {
    for (const [key, child] of Object.entries(node.properties)) {
      collectZodTreeErrors(child, [...path, key], fieldErrors, formErrors);
    }
  }

  if (Array.isArray(node.items)) {
    for (const [index, child] of node.items.entries()) {
      if (child) {
        collectZodTreeErrors(child, [...path, String(index)], fieldErrors, formErrors);
      }
    }
  }
}

/**
 * Extract only form-safe validation details from handleError() output.
 *
 * AppError and Mongoose validation details use a `fieldErrors` object.
 * Zod details use the treeified `errors / properties / items` structure.
 * All other internal details are intentionally discarded.
 */
function getActionValidationErrors(details) {
  const fieldErrors = {};
  const formErrors = [];

  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return { fieldErrors, formErrors };
  }

  if (
    details.fieldErrors &&
    typeof details.fieldErrors === "object" &&
    !Array.isArray(details.fieldErrors)
  ) {
    for (const [path, messages] of Object.entries(details.fieldErrors)) {
      if (typeof path === "string" && path.length > 0) {
        appendMessages(fieldErrors, path, messages);
      }
    }
  }

  if (Array.isArray(details.formErrors)) {
    formErrors.push(
      ...details.formErrors.filter(
        (message) => typeof message === "string" && message.length > 0
      )
    );
  }

  // Zod's treeified error object has root-level errors and nested properties.
  if (Array.isArray(details.errors) || details.properties || details.items) {
    collectZodTreeErrors(details, [], fieldErrors, formErrors);
  }

  return { fieldErrors, formErrors };
}

/**
 * Convert an application or validation error into a safe Server Action
 * response.
 *
 * The HTTP status code and arbitrary error details returned by handleError()
 * are deliberately not exposed to the Client Component. Only the stable error
 * code, public message, field errors, form errors, and the rate-limit retry
 * interval (when applicable) are returned.
 */
export function createActionErrorResponse(error) {
  const handledError = handleError(error);
  const { code, message, details } = handledError.error;
  const { fieldErrors, formErrors } = getActionValidationErrors(details);

  return {
    success: false,
    error: {
      code,
      message,
      fieldErrors,
      formErrors,
      ...(code === ERROR_CODES.RATE_LIMIT_EXCEEDED &&
      Number.isSafeInteger(details?.retryAfter) &&
      details.retryAfter > 0
        ? { retryAfter: details.retryAfter }
        : {}),
    },
  };
}
