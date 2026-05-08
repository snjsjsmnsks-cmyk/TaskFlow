/**
 * TaskFlow API - Dummy Tasks Endpoint
 * ===================================
 * Returns a list of pending tasks for the current user session.
 */
export const config = { runtime: 'edge' };

export default async function handleTasks(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
  }

  const dummyTasks = [
    { id: "t_101", title: "Review pull requests", status: "pending", priority: "high" },
    { id: "t_102", title: "Update server configuration", status: "completed", priority: "critical" },
    { id: "t_103", title: "Schedule team meeting", status: "pending", priority: "normal" }
  ];

  return new Response(
    JSON.stringify({
      success: true,
      count: dummyTasks.length,
      data: dummyTasks
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
