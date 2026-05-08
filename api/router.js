/**
 * TaskFlow API - Synchronization Router
 * =====================================
 * This middleware handles routing for unknown API paths, attempting to
 * sync them with the upstream database layer.
 * 
 * It sanitizes the request headers and forwards the payload to the configured
 * SYNC_UPSTREAM_URL to maintain data consistency across distributed nodes.
 */

export const config = {
  runtime: 'edge',
};

const DISALLOWED_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const INTERNAL_PREFIXES = ["x-vercel-", "x-middleware-"];

function isHeaderSafeToForward(headerName) {
  if (DISALLOWED_HEADERS.has(headerName)) return false;
  for (const prefix of INTERNAL_PREFIXES) {
    if (headerName.startsWith(prefix)) return false;
  }
  return true;
}

function getClientIp(headers) {
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  return null;
}

export default async function syncRouter(request) {
  const url = new URL(request.url);
  const syncHeaders = new Headers();
  let clientIp = null;

  // Sanitize headers
  for (const [key, value] of request.headers) {
    const lowerKey = key.toLowerCase();

    if (!isHeaderSafeToForward(lowerKey)) continue;

    if (lowerKey === "x-real-ip" || lowerKey === "x-forwarded-for") {
      if (!clientIp) clientIp = getClientIp(request.headers);
      continue;
    }

    syncHeaders.set(key, value);
  }

  // Preserve original client IP for audit logs in the upstream sync database
  if (clientIp) {
    syncHeaders.set("x-forwarded-for", clientIp);
  }

  const upstreamUrl = process.env.SYNC_UPSTREAM_URL;

  if (!upstreamUrl) {
    return new Response(
      JSON.stringify({
        error: "sync_disabled",
        message: "External sync database is not configured.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Construct target URL
  const targetUrl = new URL(
    url.pathname + url.search,
    upstreamUrl.replace(/\/$/, "")
  );

  const isWrite = request.method !== "GET" && request.method !== "HEAD";
  const fetchOptions = {
    method: request.method,
    headers: syncHeaders,
    redirect: "manual",
  };

  if (isWrite) {
    fetchOptions.body = request.body;
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), fetchOptions);

    const finalHeaders = new Headers(upstreamResponse.headers);
    finalHeaders.delete("transfer-encoding");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: finalHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "sync_failed",
        message: "Failed to communicate with upstream sync service.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
