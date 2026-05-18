// Vercel Node.js serverless proxy — forwards /api/* requests to BACKEND_URL
const DROP = new Set(['host', 'connection', 'transfer-encoding', 'upgrade', 'keep-alive', 'content-length']);

module.exports = async function handler(req, res) {
  const backend = process.env.BACKEND_URL;
  if (!backend) {
    console.error('[proxy] BACKEND_URL env var not set');
    return res.status(500).json({ error: 'BACKEND_URL not configured' });
  }

  // Vercel passes the original request URL even when routing via rewrite
  const target = backend.replace(/\/$/, '') + req.url;
  console.log(`[proxy] ${req.method} ${req.url} → ${target}`);

  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (!DROP.has(k.toLowerCase())) headers[k] = v;
  }

  const init = { method: req.method, headers };
  if (req.body != null && req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(target, init);
    res.status(upstream.status);
    for (const [k, v] of upstream.headers.entries()) {
      if (!DROP.has(k.toLowerCase())) res.setHeader(k, v);
    }
    // arrayBuffer preserves binary responses (PDF downloads)
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error('[proxy] fetch error:', err.message, '→', target);
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
};
