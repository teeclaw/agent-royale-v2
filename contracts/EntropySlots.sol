// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CasinoOwnable.sol";

/**
 * @title EntropySlots
 * @notice 3-reel slot machine with Pyth Entropy randomness
 * @dev Generates 3 independent reel results from entropy callback
 * @custom:security-contact security@agentroyale.xyz
 */

interface IEntropy {
    function getFee(address provider) external view returns (uint256);
    function getDefaultProvider() external view returns (address);
    function getFeeV2() external view returns (uint256);
    function getFeeV2(uint32 gasLimit) external view returns (uint256);
    function getFeeV2(address provider, uint32 gasLimit) external view returns (uint256);
    function requestV2() external payable returns (uint64);
    function requestV2(uint32 gasLimit) external payable returns (uint64);
    function requestV2(address provider) external payable returns (uint64);
    function requestV2(address provider, uint32 gasLimit) external payable returns (uint64);
    function requestV2(address provider, bytes32 userRandomNumber, uint32 gasLimit) external payable returns (uint64);
    function requestWithCallback(address provider, bytes32 userRandomNumber) external payable returns (uint64);
}

abstract contract EntropyConsumer {
    error EntropyConsumer__OnlyEntropy();
    error EntropyConsumer__ZeroEntropyAddress();

    address public entropy;

    constructor(address _entropy) {
        if (_entropy == address(0)) revert EntropyConsumer__ZeroEntropyAddress();
        entropy = _entropy;
    }

    function _entropyCallback(uint64 sequenceNumber, address provider, bytes32 entropyRandomNumber) external {
        if (msg.sender != getEntropy()) revert EntropyConsumer__OnlyEntropy();
        entropyCallback(sequenceNumber, provider, entropyRandomNumber);
    }

    function getEntropy() internal view virtual returns (address);

    function entropyCallback(uint64 sequenceNumber, address provider, bytes32 entropyRandomNumber) internal virtual;
}

contract EntropySlots is CasinoOwnable, EntropyConsumer, ReentrancyGuard {
    // ══════════════════════════════════════════════════════════════════════════════
    // TYPES
    // ══════════════════════════════════════════════════════════════════════════════

    enum RoundState {
        None,
        Requested,
        Fulfilled,
        Settled,
        Expired,
        Failed
    }

    struct Round {
        bytes32 roundId;
        address agent;
        uint256 betAmount;
        uint64 sequenceNumber;
        bytes32 userRandom;
        bytes32 entropyRandom;
        uint256 requestedAt;
        uint256 fulfilledAt;
        RoundState state;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // STORAGE
    // ══════════════════════════════════════════════════════════════════════════════

    mapping(bytes32 => Round) public rounds;
    mapping(uint64 => bytes32) public sequenceToRound;

    address public entropyProvider;
    uint32 public callbackGasLimit = 120_000;
    uint256 public roundTtl = 5 minutes;
    bool public paused;

    // ══════════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ══════════════════════════════════════════════════════════════════════════════

    event EntropyProviderUpdated(address indexed provider);
    event EntropyAddressUpdated(address indexed entropyAddress);
    event CallbackGasLimitUpdated(uint32 gasLimit);
    event RoundTtlUpdated(uint256 ttl);
    event PausedSet(bool paused);

    event EntropyRequested(
        bytes32 indexed roundId,
        uint64 indexed sequenceNumber,
        address indexed agent,
        uint256 betAmount,
        bytes32 userRandom,
        uint256 fee
    );
    event EntropyFulfilled(bytes32 indexed roundId, uint64 indexed sequenceNumber, bytes32 entropyRandom);
    event RoundStateChanged(bytes32 indexed roundId, RoundState state);

    // ══════════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ══════════════════════════════════════════════════════════════════════════════

    error EntropySlots__InvalidRound();
    error EntropySlots__AlreadyExists();
    error EntropySlots__RoundNotReady();
    error EntropySlots__RoundNotExpired();
    error EntropySlots__Paused();
    error EntropySlots__ZeroProvider();
    error EntropySlots__ZeroEntropy();
    error EntropySlots__InvalidTtl();
    error EntropySlots__InvalidGasLimit();
    error EntropySlots__FeeTooLow(uint256 sent, uint256 requiredFee);

    // ══════════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ══════════════════════════════════════════════════════════════════════════════

    modifier notPaused() {
        if (paused) revert EntropySlots__Paused();
        _;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════════════════════

    constructor(address _casino, address _entropy, address _entropyProvider)
        CasinoOwnable(_casino)
        EntropyConsumer(_entropy)
    {
        if (_entropyProvider == address(0)) revert EntropySlots__ZeroProvider();
        entropyProvider = _entropyProvider;
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════

    function setPaused(bool _paused) external onlyCasino {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setEntropyProvider(address _provider) external onlyCasino {
        if (_provider == address(0)) revert EntropySlots__ZeroProvider();
        entropyProvider = _provider;
        emit EntropyProviderUpdated(_provider);
    }

    function setEntropy(address _entropy) external onlyCasino {
        if (_entropy == address(0)) revert EntropySlots__ZeroEntropy();
        entropy = _entropy;
        emit EntropyAddressUpdated(_entropy);
    }

    function setCallbackGasLimit(uint32 _gasLimit) external onlyCasino {
        if (_gasLimit < 50_000 || _gasLimit > 5_000_000) revert EntropySlots__InvalidGasLimit();
        callbackGasLimit = _gasLimit;
        emit CallbackGasLimitUpdated(_gasLimit);
    }

    function setRoundTtl(uint256 _ttl) external onlyCasino {
        if (!(_ttl >= 30 seconds && _ttl <= 24 hours)) revert EntropySlots__InvalidTtl();
        roundTtl = _ttl;
        emit RoundTtlUpdated(_ttl);
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════

    function quoteFee() public view returns (uint256) {
        IEntropy e = IEntropy(entropy);

        address provider = entropyProvider;
        if (provider == address(0)) {
            try e.getDefaultProvider() returns (address p) {
                provider = p;
            } catch {}
        }

        if (callbackGasLimit > 0) {
            try e.getFeeV2(provider, callbackGasLimit) returns (uint256 feeProviderGas) {
                return feeProviderGas;
            } catch {}
            try e.getFeeV2(callbackGasLimit) returns (uint256 feeV2Gas) {
                return feeV2Gas;
            } catch {}
        }

        try e.getFeeV2() returns (uint256 feeV2) {
            return feeV2;
        } catch {}

        return e.getFee(provider);
    }

    function requestSlotSpin(
        bytes32 roundId,
        address agent,
        uint256 betAmount,
        bytes32 userRandom
    ) external payable onlyCasino notPaused nonReentrant returns (uint64 sequenceNumber) {
        if (roundId == bytes32(0) || agent == address(0)) revert EntropySlots__InvalidRound();
        if (rounds[roundId].state != RoundState.None) revert EntropySlots__AlreadyExists();

        uint256 fee = quoteFee();
        if (msg.value < fee) revert EntropySlots__FeeTooLow(msg.value, fee);

        IEntropy e = IEntropy(entropy);

        address provider = entropyProvider;
        if (provider == address(0)) {
            try e.getDefaultProvider() returns (address p) {
                provider = p;
            } catch {}
        }

        // Primary path: explicit provider + userContribution + gas limit
        if (callbackGasLimit > 0) {
            try e.requestV2{value: fee}(provider, userRandom, callbackGasLimit) returns (uint64 seqProviderUserGas) {
                sequenceNumber = seqProviderUserGas;
            } catch {}
        }

        // Fallback: provider + gas limit
        if (sequenceNumber == 0 && callbackGasLimit > 0) {
            try e.requestV2{value: fee}(provider, callbackGasLimit) returns (uint64 seqProviderGas) {
                sequenceNumber = seqProviderGas;
            } catch {}
        }

        // Fallback: provider only
        if (sequenceNumber == 0) {
            try e.requestV2{value: fee}(provider) returns (uint64 seqProvider) {
                sequenceNumber = seqProvider;
            } catch {}
        }

        // Legacy fallback
        if (sequenceNumber == 0) {
            try e.requestWithCallback{value: fee}(provider, userRandom) returns (uint64 seqLegacy) {
                sequenceNumber = seqLegacy;
            } catch {}
        }

        if (sequenceNumber == 0) revert EntropySlots__RoundNotReady();

        Round storage r = rounds[roundId];
        r.roundId = roundId;
        r.agent = agent;
        r.betAmount = betAmount;
        r.sequenceNumber = sequenceNumber;
        r.userRandom = userRandom;
        r.requestedAt = block.timestamp;
        r.state = RoundState.Requested;

        sequenceToRound[sequenceNumber] = roundId;

        emit EntropyRequested(roundId, sequenceNumber, agent, betAmount, userRandom, fee);
    }

    function markSettled(bytes32 roundId) external onlyCasino {
        Round storage r = rounds[roundId];
        if (r.state != RoundState.Fulfilled) revert EntropySlots__RoundNotReady();
        r.state = RoundState.Settled;
        emit RoundStateChanged(roundId, RoundState.Settled);
    }

    function markExpired(bytes32 roundId) external onlyCasino {
        Round storage r = rounds[roundId];
        if (r.state != RoundState.Requested) revert EntropySlots__RoundNotReady();
        if (block.timestamp <= r.requestedAt + roundTtl) revert EntropySlots__RoundNotExpired();
        r.state = RoundState.Expired;
        emit RoundStateChanged(roundId, RoundState.Expired);
    }

    function getRound(bytes32 roundId)
        external
        view
        returns (
            address agent,
            uint256 betAmount,
            uint64 sequenceNumber,
            bytes32 userRandom,
            bytes32 entropyRandom,
            uint256 requestedAt,
            uint256 fulfilledAt,
            RoundState state
        )
    {
        Round storage r = rounds[roundId];
        return (
            r.agent,
            r.betAmount,
            r.sequenceNumber,
            r.userRandom,
            r.entropyRandom,
            r.requestedAt,
            r.fulfilledAt,
            r.state
        );
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════════════

    function getEntropy() internal view override returns (address) {
        return entropy;
    }

    function entropyCallback(uint64 sequenceNumber, address /*provider*/, bytes32 entropyRandomNumber) internal override {
        bytes32 roundId = sequenceToRound[sequenceNumber];
        if (roundId == bytes32(0)) return;

        Round storage r = rounds[roundId];
        if (r.state != RoundState.Requested) return;

        r.entropyRandom = entropyRandomNumber;
        r.fulfilledAt = block.timestamp;
        r.state = RoundState.Fulfilled;

        emit EntropyFulfilled(roundId, sequenceNumber, entropyRandomNumber);
    }
}
