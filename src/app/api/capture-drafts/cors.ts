export const captureDraftCorsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

export function captureDraftOptionsResponse() {
  return new Response(null, {
    headers: captureDraftCorsHeaders,
    status: 204,
  });
}
