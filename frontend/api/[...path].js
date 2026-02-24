const UPSTREAM = process.env.AGENT_ROYALE_UPSTREAM || 'https://api.agentroyale.xyz';

module.exports = async (req, res) => {
  try {
    const pathParts = Array.isArray(req.query.path)
      ? req.query.path
      : req.query.path
        ? [req.query.path]
        : [];

    const upstreamUrl = new URL(`${UPSTREAM}/${pathParts.join('/')}`);

    for (const [k, v] of Object.entries(req.query || {})) {
      if (k === 'path') continue;
      if (Array.isArray(v)) v.forEach(x => upstreamUrl.searchParams.append(k, x));
      else if (v !== undefined) upstreamUrl.searchParams.set(k, v);
    }

    const method = req.method || 'GET';
    const headers = { 'content-type': req.headers['content-type'] || 'application/json' };
    const init = { method, headers };

    if (method !== 'GET' && method !== 'HEAD') {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }

    const upstreamRes = await fetch(upstreamUrl.toString(), init);
    const text = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader('content-type', upstreamRes.headers.get('content-type') || 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: true, message: `Proxy error: ${err.message}` });
  }
};
