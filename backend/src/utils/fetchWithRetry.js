const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Transient server-side statuses: worth retrying. Everything else (400, 401,
// 403, 404...) means the request itself is wrong, so retrying would just
// fail the same way again.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// Turns a thrown fetch error into a short readable reason
const describeError = (err, timeoutMs) => {
  if (err.name === 'TimeoutError') return `timed out after ${timeoutMs}ms`;
  return err.cause?.code ?? err.message; // e.g. ETIMEDOUT, ENOTFOUND, "fetch failed"
};

// Exponential backoff (1s, 2s, 4s...) plus up to 250ms of random jitter
const backoffMs = (attempt) => 1000 * 2 ** (attempt - 1) + Math.random() * 250;

export const fetchWithRetry = async (
  url,
  options,
  { label = 'request', maxAttempts = 3, timeoutMs = 20000 } = {}
) => {
  for (let attempt = 1; ; attempt++) {
    let response;

    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      // No response at all: network failure, DNS problem, or timeout
      const reason = describeError(err, timeoutMs);
      if (attempt >= maxAttempts) {
        throw new Error(`${label} failed after ${attempt} attempts: ${reason}`);
      }
      const delay = backoffMs(attempt);
      console.warn(`${label}: ${reason}, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxAttempts})`);
      await sleep(delay);
      continue;
    }

    if (response.ok) return response;

    const body = await response.text();

    if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
      const delay = backoffMs(attempt);
      console.warn(`${label}: HTTP ${response.status}, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxAttempts})`);
      await sleep(delay);
      continue;
    }

  // Full upstream body goes to the server log only, never into the error message
console.error(`${label} error body:`, body.slice(0, 500));
throw new Error(`${label} failed (${response.status})`);
  }
};