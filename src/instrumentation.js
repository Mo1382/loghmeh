export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerEnv } = await import("./lib/config/env.js");

    validateServerEnv();
  }
}
