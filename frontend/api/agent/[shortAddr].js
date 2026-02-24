const proxy = require('../_proxy');

module.exports = async (req, res) => {
  const shortAddr = req.query.shortAddr;
  if (!shortAddr) return res.status(400).json({ error: true, message: 'shortAddr required' });
  return proxy(req, res, `/api/agent/${encodeURIComponent(shortAddr)}`);
};
