/**
 * Agent Royale SDK
 *
 * Aligned with current Vercel/Supabase API surface.
 */

const { ethers } = require('ethers');
const StealthAddress = require('../privacy/stealth');
const CommitReveal = require('../server/commit-reveal');
const fs = require('fs').promises;
const path = require('path');

class AgentCasinoClient {
  constructor(casinoUrl, options = {}) {
    const normalized = String(casinoUrl || 'https://www.agentroyale.xyz/api/a2a/casino').replace(/\/$/, '');
    this.casinoUrl = /\/a2a\/casino$/.test(normalized) ? normalized : `${normalized}/a2a/casino`;
    this.apiBase = this.casinoUrl.replace(/\/a2a\/casino$/, '');

    this.backupDir = options.backupDir || './casino-states';
    this.stealth = null;
    this.states = [];
    this.gamesPlayed = 0;
  }

  // Session
  async startSession(depositEth, options = {}) {
    if (typeof depositEth === 'number') depositEth = depositEth.toString();

    if (options.masterKey && options.index !== undefined) {
      this.stealth = StealthAddress.deriveFromMaster(options.masterKey, options.index);
    } else {
      this.stealth = StealthAddress.generate();
    }

    await fs.mkdir(this.backupDir, { recursive: true });

    const channelResult = await this._request('open_channel', {
      stealthAddress: this.stealth.stealthAddress,
      agentDeposit: depositEth,
      casinoDeposit: String(options.casinoDeposit || depositEth),
      ...(options.settlementMode ? { settlementMode: options.settlementMode } : {}),
    });

    await this._backup();

    return {
      stealthAddress: this.stealth.stealthAddress,
      channel: channelResult,
    };
  }

  async closeSession() {
    this._assertSession();

    const result = await this._request('close_channel', {
      stealthAddress: this.stealth.stealthAddress,
    });

    this.states.push({
      agentBalance: result.agentBalance,
      casinoBalance: result.casinoBalance,
      nonce: result.nonce,
      signature: result.signature,
      final: true,
      timestamp: Date.now(),
    });

    await this._backup();

    return {
      ...result,
      sessionStats: {
        gamesPlayed: this.gamesPlayed,
        statesStored: this.states.length,
      },
    };
  }

  // Commit-Reveal games
  async playSlots(betEth) {
    this._assertSession();
    if (typeof betEth === 'number') betEth = betEth.toString();

    const commitResult = await this._request('slots_commit', {
      stealthAddress: this.stealth.stealthAddress,
      betAmount: betEth,
    });

    const agentSeed = ethers.hexlify(ethers.randomBytes(32));

    const result = await this._request('slots_reveal', {
      stealthAddress: this.stealth.stealthAddress,
      agentSeed,
    });

    this._verifyCommitment(commitResult.commitment, result);
    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();

    return result;
  }

  async playCoinflip(betEth, choice) {
    this._assertSession();
    if (typeof betEth === 'number') betEth = betEth.toString();
    if (!['heads', 'tails'].includes(choice)) throw new Error('Choice must be "heads" or "tails"');

    const commitResult = await this._request('coinflip_commit', {
      stealthAddress: this.stealth.stealthAddress,
      betAmount: betEth,
      choice,
    });

    const agentSeed = ethers.hexlify(ethers.randomBytes(32));

    const result = await this._request('coinflip_reveal', {
      stealthAddress: this.stealth.stealthAddress,
      agentSeed,
    });

    this._verifyCommitment(commitResult.commitment, result);
    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();

    return result;
  }

  async playDice(betEth, choice, target) {
    this._assertSession();
    if (typeof betEth === 'number') betEth = betEth.toString();
    if (!['over', 'under'].includes(choice)) throw new Error('Choice must be "over" or "under"');
    if (!Number.isInteger(target) || target < 1 || target > 99) {
      throw new Error('Target must be an integer between 1 and 99');
    }

    const commitResult = await this._request('dice_commit', {
      stealthAddress: this.stealth.stealthAddress,
      betAmount: betEth,
      choice,
      target,
    });

    const agentSeed = ethers.hexlify(ethers.randomBytes(32));

    const result = await this._request('dice_reveal', {
      stealthAddress: this.stealth.stealthAddress,
      agentSeed,
    });

    this._verifyCommitment(commitResult.commitment, result);
    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();

    return result;
  }

  // Entropy games
  async playSlotsEntropy(betEth, options = {}) {
    this._assertSession();
    if (typeof betEth === 'number') betEth = betEth.toString();

    const committed = await this._request('slots_entropy_commit', {
      stealthAddress: this.stealth.stealthAddress,
      betAmount: betEth,
    });

    if (options.autoFinalize === false) return committed;

    await this._waitEntropy('slots', committed.roundId, options);
    const result = await this._request('slots_entropy_finalize', {
      stealthAddress: this.stealth.stealthAddress,
      roundId: committed.roundId,
    });

    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();
    return result;
  }

  async playCoinflipEntropy(betEth, choice, options = {}) {
    this._assertSession();
    if (typeof betEth === 'number') betEth = betEth.toString();
    if (!['heads', 'tails'].includes(choice)) throw new Error('Choice must be "heads" or "tails"');

    const committed = await this._request('coinflip_entropy_commit', {
      stealthAddress: this.stealth.stealthAddress,
      betAmount: betEth,
      choice,
    });

    if (options.autoFinalize === false) return committed;

    await this._waitEntropy('coinflip', committed.roundId, options);
    const result = await this._request('coinflip_entropy_finalize', {
      stealthAddress: this.stealth.stealthAddress,
      roundId: committed.roundId,
    });

    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();
    return result;
  }

  async playDiceEntropy(betEth, choice, target, options = {}) {
    this._assertSession();
    if (typeof betEth === 'number') betEth = betEth.toString();
    if (!['over', 'under'].includes(choice)) throw new Error('Choice must be "over" or "under"');
    if (!Number.isInteger(target) || target < 1 || target > 99) {
      throw new Error('Target must be an integer between 1 and 99');
    }

    const committed = await this._request('dice_entropy_commit', {
      stealthAddress: this.stealth.stealthAddress,
      betAmount: betEth,
      choice,
      target,
    });

    if (options.autoFinalize === false) return committed;

    await this._waitEntropy('dice', committed.roundId, options);
    const result = await this._request('dice_entropy_finalize', {
      stealthAddress: this.stealth.stealthAddress,
      roundId: committed.roundId,
    });

    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();
    return result;
  }

  async buyLottoEntropyTicket(pickedNumber, ticketCount = 1, options = {}) {
    this._assertSession();

    const committed = await this._request('lotto_entropy_buy', {
      stealthAddress: this.stealth.stealthAddress,
      pickedNumber,
      ticketCount,
    });

    if (options.autoFinalize === false) return committed;

    await this._waitEntropy('lotto', committed.roundId, options);
    const result = await this._request('lotto_entropy_finalize', {
      stealthAddress: this.stealth.stealthAddress,
      roundId: committed.roundId,
    });

    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();
    return result;
  }

  // Lotto classic
  async buyLottoTicket(pickedNumber, ticketCount = 1) {
    this._assertSession();
    const result = await this._request('lotto_buy', {
      stealthAddress: this.stealth.stealthAddress,
      pickedNumber,
      ticketCount,
    });

    this._storeState(result);
    this.gamesPlayed++;
    await this._backup();
    return result;
  }

  async getLottoStatus() {
    return await this._request('lotto_status', {});
  }

  async getLottoHistory() {
    throw new Error('lotto_history is not available in current API');
  }

  async claimLottoWinnings() {
    throw new Error('lotto_claim is not available in current API');
  }

  // Info
  async getStatus() {
    this._assertSession();
    return await this._request('channel_status', { stealthAddress: this.stealth.stealthAddress });
  }

  async getCasinoInfo() {
    return await this._request('info', {});
  }

  async getStats() {
    try {
      return await this._getJson(`${this.apiBase}/casino/stats`);
    } catch {
      return await this._request('stats', {});
    }
  }

  async getGames() {
    return await this._getJson(`${this.apiBase}/casino/games`);
  }

  getLatestState() {
    if (this.states.length === 0) return null;
    return this.states[this.states.length - 1];
  }

  getAllStates() {
    return [...this.states];
  }

  async restoreSession(backupFile) {
    const data = JSON.parse(await fs.readFile(backupFile, 'utf-8'));
    this.stealth = { stealthAddress: data.stealthAddress };
    this.states = data.states || [];
    this.gamesPlayed = data.gamesPlayed || 0;
    return data;
  }

  // Internal
  async _waitEntropy(game, roundId, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 120000);
    const pollMs = Number(options.pollMs || 2500);
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const status = await this._request(`${game}_entropy_status`, {
        stealthAddress: this.stealth.stealthAddress,
        roundId,
      });

      if (status.state === 'entropy_fulfilled') return status;
      if (status.state === 'expired') throw new Error(`Entropy round expired: ${roundId}`);

      await new Promise(r => setTimeout(r, pollMs));
    }

    throw new Error(`Entropy wait timeout after ${timeoutMs}ms for round ${roundId}`);
  }

  _verifyCommitment(commitment, result) {
    if (!result.proof || !result.proof.casinoSeed) return;

    const isValid = CommitReveal.verify(commitment, result.proof.casinoSeed);
    if (!isValid) {
      this._saveEvidence('commitment_mismatch', {
        commitment,
        casinoSeed: result.proof.casinoSeed,
        result,
        timestamp: Date.now(),
      }).catch(() => {});

      throw new Error('Casino cheated: commitment verification failed. Evidence saved.');
    }
  }

  _storeState(result) {
    if (!result || (result.nonce === undefined || result.nonce === null)) return;
    this.states.push({
      agentBalance: result.agentBalance,
      casinoBalance: result.casinoBalance,
      nonce: result.nonce,
      signature: result.signature,
      timestamp: Date.now(),
    });
  }

  _assertSession() {
    if (!this.stealth?.stealthAddress) {
      throw new Error('No active session. Call startSession() first.');
    }
  }

  async _request(action, params) {
    const body = {
      version: '0.3.0',
      from: { name: 'Anonymous' },
      message: {
        contentType: 'application/json',
        content: { action, ...params },
      },
    };

    const response = await fetch(this.casinoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data?.message?.content?.message || data?.message || response.statusText;
      throw new Error(`Casino returned ${response.status}: ${msg}`);
    }

    if (data.message?.content?.error) {
      throw new Error(data.message.content.message || 'Unknown casino error');
    }

    return data.message?.content || data;
  }

  async _getJson(url) {
    const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
    return await response.json();
  }

  async _backup() {
    if (!this.stealth) return;

    const filename = `${this.stealth.stealthAddress.slice(0, 10)}-${Date.now()}.json`;
    const filepath = path.join(this.backupDir, filename);

    await fs.writeFile(
      filepath,
      JSON.stringify(
        {
          stealthAddress: this.stealth.stealthAddress,
          states: this.states,
          gamesPlayed: this.gamesPlayed,
          exportedAt: Date.now(),
        },
        null,
        2,
      ),
    );
  }

  async _saveEvidence(type, evidence) {
    const dir = path.join(this.backupDir, 'evidence');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${type}-${Date.now()}.json`), JSON.stringify(evidence, null, 2));
  }
}

module.exports = AgentCasinoClient;
