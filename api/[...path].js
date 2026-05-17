export const config = { runtime: 'edge' };

export default async function handler(req) {
  const backend = process.env.BACKEND_URL;
  if (!backend) {
    return new Response(JSON.stringify({ error: 'BACKEND_URL not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const targetUrl = backend.replace(/\/$/, '') + url.pathname + url.search;

  // Forward headers, dropping hop-by-hop headers
  const headers = {};
  const hopByHop = new Set(['host', 'connection', 'transfer-encoding', 'upgrade', 'keep-alive', 'proxy-authorization', 'te', 'trailers']);
  for (const [k, v] of req.headers.entries()) {
    if (!hopByHop.has(k.toLowerCase())) {
      headers[k] = v;
    }
  }

  const fetchInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchInit.body = req.body;
  }

  try {
    const res = await fetch(targetUrl, fetchInit);

    const resHeaders = {};
    const dropRes = new Set(['connection', 'transfer-encoding', 'keep-alive']);
    for (const [k, v] of res.headers.entries()) {
      if (!dropRes.has(k.toLowerCase())) {
        resHeaders[k] = v;
      }
    }

    return new Response(res.body, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error', detail: err.message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
