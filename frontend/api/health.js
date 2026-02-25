const { rest, hasConfig } = require('./_supabase');

function kmsHealth() {
  const useKms = String(process.env.USE_KMS || '').toLowerCase() === 'true';
  const hasServiceAccount = Boolean(
    process.env.GCP_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  );

  return {
    required: useKms,
    configured: useKms ? hasServiceAccount : true,
    mode: useKms ? 'kms' : 'private-key-fallback',
  };
}

module.exports = async (req, res) => {
  if (!hasConfig()) {
    return res.status(500).json({ status: 'error', message: 'Supabase env not configured' });
  }

  try {
    // lightweight connectivity probe
    await rest('casino_channels?select=agent&limit=1');

    return res.status(200).json({
      status: 'ok',
      runtime: 'vercel',
      storage: 'supabase',
      kms: kmsHealth(),
      timestamp: Date.now(),
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
