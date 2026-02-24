# Vercel-Only Cutover Checklist

Goal: Agent Royale production runs without Caddy/VM dependency.

## 1) Domain routing
- `agentroyale.xyz` -> Vercel project (frontend)
- `www.agentroyale.xyz` -> Vercel project
- Canonical API host: `www.agentroyale.xyz/api`
- Remove conflicting A/AAAA records that point to VM for production hosts

## 2) Certs
- Verify TLS valid for `agentroyale.xyz` and `www.agentroyale.xyz` in Vercel Domains UI
- Resolve any HTTP-01/ownership challenge failures before cutover

## 3) API health (must pass)
- `https://agentroyale.xyz/api/health`
- `https://www.agentroyale.xyz/api/health`
- `https://agentroyale.xyz/api/dashboard/state`

## 4) Gameplay smoke test (must pass on Vercel)
- open_channel
- one slots round (commit/reveal)
- one coinflip round (commit/reveal)
- lotto_status + lotto_buy
- close_channel

## 5) Data verification in Supabase
- channel row created/updated
- round rows inserted
- events inserted
- game stats incremented

## 6) Disable VM as production path
- Keep VM service for development only
- Ensure production DNS no longer points to VM/Caddy
- Keep rollback notes if emergency reroute is needed

## 7) Observability
- Watch Vercel function logs for errors and timeout spikes
- Track API error rates for first 24h post-cutover
