/**
 * request.json() throws on an empty or malformed body (e.g.
 * "Unexpected end of JSON input"), which would otherwise crash the route
 * handler with an unhandled exception. Route handlers should use this
 * instead and return a clean 400 when it comes back null.
 */
export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
