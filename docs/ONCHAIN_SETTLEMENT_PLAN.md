# Onchain Settlement Plan (Vercel)

Status: in progress
Goal: complete migration so production settlement is provably onchain.

## Mode
- Default target mode: `onchain-settle`
- Fallback mode: `offchain-ledger` (feature flag only)

## Contract flow
1. Agent tx: `ChannelManager.openChannel()` with min deposit >= 0.001 ETH
2. Casino tx: `ChannelManager.fundCasinoSide(agent)`
3. Offchain gameplay rounds produce signed state
4. Agent tx: `ChannelManager.closeChannel(agentBalance, casinoBalance, nonce, casinoSig)`

## API surface changes (`/api/a2a/casino`)

### open_channel
Request additions:
- `mode`: `onchain-settle` | `offchain-ledger` (default onchain in prod)
- `agentSignedOpenTx` optional (if client signs)

Response additions:
- `settlementMode`
- `openTxHash`
- `fundTxHash`
- `chainId`

### close_channel
Request additions:
- `agentSignedCloseTx` optional (if client signs)

Response additions:
- `closeTxHash`
- `settledOnchain: true|false`

## Signing model
- Casino signing: server-side signer only
- Agent signing: client-side preferred (server never holds user private keys)

## Idempotency and replay safety
- open/fund/close must be idempotent using `casino_requests.request_key`
- if tx hash already exists for request key, return existing hash

## Proof requirements
- All three tx hashes persisted and queryable
- Receipts + block numbers stored
- BaseScan links returned in API response and visible in dashboard detail

## Minimum real-fund smoke target
- agentDeposit: 0.001 ETH
- casinoDeposit: 0.001 ETH
- one game bet: 0.0001 ETH
- cooperative close onchain

## Hard blockers to resolve before go-live
1. Vercel-accessible casino signer (secure secret or external signer service)
2. Agent-side signing UX for open/close tx
3. Gas/confirmation timeout handling in API
