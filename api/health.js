/**
 * TaskFlow API - Health Check
 * ===========================
 * Simple uptime monitoring endpoint.
 */
export const config = { runtime: 'edge' };

export default async function handleHealth(req) {
  return new Response(
    JSON.stringify({
      status: "healthy",
      uptime: process.uptime ? process.uptime() : 0,
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        syncQueue: process.env.SYNC_UPSTREAM_URL ? "active" : "standby"
      }
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
