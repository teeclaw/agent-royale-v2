const UPSTREAM = process.env.AGENT_ROYALE_UPSTREAM || 'https://api.agentroyale.xyz';

module.exports = async function proxy(req, res, targetPath) {
  try {
    const upstreamUrl = new URL(`${UPSTREAM}${targetPath.startsWith('/') ? '' : '/'}${targetPath}`);

    if (req.query) {
      for (const [k, v] of Object.entries(req.query)) {
        if (Array.isArray(v)) v.forEach(x => upstreamUrl.searchParams.append(k, x));
        else if (v !== undefined) upstreamUrl.searchParams.set(k, v);
      }
    }

    const method = req.method || 'GET';
    const headers = { 'content-type': req.headers['content-type'] || 'application/json' };
    const init = { method, headers };

    if (method !== 'GET' && method !== 'HEAD') {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }

    const upstreamRes = await fetch(upstreamUrl.toString(), init);
    const body = await upstreamRes.text();

    res.status(upstreamRes.status);
    res.setHeader('content-type', upstreamRes.headers.get('content-type') || 'application/json');
    res.setHeader('cache-control', 'no-store');
    return res.send(body);
  } catch (err) {
    return res.status(502).json({ error: true, message: `Proxy error: ${err.message}` });
  }
};
