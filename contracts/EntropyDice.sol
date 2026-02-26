// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CasinoOwnable.sol";

/**
 * @title EntropyDice
 * @notice Dice game with Pyth Entropy: roll over or under a target (1-99)
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

contract EntropyDice is CasinoOwnable, EntropyConsumer, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                            TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/

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
        bytes32 userRandom;
        bytes32 entropyRandom;
        uint256 betAmount;
        uint256 requestedAt;
        uint256 fulfilledAt;
        address agent;
        uint64 sequenceNumber;
        uint8 choice; // 0=over, 1=under
        uint8 target; // 1-99
        RoundState state;
    }

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    mapping(bytes32 => Round) public rounds;
    mapping(uint64 => bytes32) public sequenceToRound;

    address public entropyProvider;
    uint32 public callbackGasLimit;
    uint256 public roundTtl;
    bool public paused;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event EntropyProviderUpdated(address indexed provider);
    event EntropyAddressUpdated(address indexed entropyAddress);
    event CallbackGasLimitUpdated(uint32 gasLimit);
    event RoundTtlUpdated(uint256 ttl);
    event PausedSet(bool paused);

    event EntropyRequested(
        bytes32 indexed roundId,
        uint64 indexed sequenceNumber,
        address indexed agent,
        uint8 choice,
        uint8 target,
        uint256 betAmount,
        bytes32 userRandom,
        uint256 fee
    );
    event EntropyFulfilled(bytes32 indexed roundId, uint64 indexed sequenceNumber, bytes32 entropyRandom);
    event RoundStateChanged(bytes32 indexed roundId, RoundState state);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error EntropyDice__InvalidRound();
    error EntropyDice__InvalidChoice();
    error EntropyDice__InvalidTarget();
    error EntropyDice__AlreadyExists();
    error EntropyDice__RoundNotReady();
    error EntropyDice__RoundNotExpired();
    error EntropyDice__Paused();
    error EntropyDice__ZeroProvider();
    error EntropyDice__ZeroEntropy();
    error EntropyDice__InvalidTtl();
    error EntropyDice__InvalidGasLimit();
    error EntropyDice__FeeTooLow(uint256 sent, uint256 requiredFee);

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier notPaused() {
        if (paused) revert EntropyDice__Paused();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _casino, address _entropy, address _entropyProvider)
        CasinoOwnable(_casino)
        EntropyConsumer(_entropy)
    {
        if (_entropyProvider == address(0)) revert EntropyDice__ZeroProvider();
        entropyProvider = _entropyProvider;
        callbackGasLimit = 120_000;
        roundTtl = 5 minutes;
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function requestDice(
        bytes32 roundId,
        address agent,
        uint8 choice,
        uint8 target,
        uint256 betAmount,
        bytes32 userRandom
    ) external payable nonReentrant onlyCasino notPaused returns (uint64 sequenceNumber) {
        if (roundId == bytes32(0) || agent == address(0)) revert EntropyDice__InvalidRound();
        if (choice > 1) revert EntropyDice__InvalidChoice();
        if (target < 1 || target > 99) revert EntropyDice__InvalidTarget();
        
        // Validate edge cases
        if (choice == 0 && target >= 99) revert EntropyDice__InvalidTarget(); // Can't roll over 99
        if (choice == 1 && target <= 1) revert EntropyDice__InvalidTarget(); // Can't roll under 1
        
        if (rounds[roundId].state != RoundState.None) revert EntropyDice__AlreadyExists();

        uint256 fee = quoteFee();
        if (msg.value < fee) revert EntropyDice__FeeTooLow(msg.value, fee);

        IEntropy e = IEntropy(entropy);

        address provider = entropyProvider;
        if (provider == address(0)) {
            try e.getDefaultProvider() returns (address p) {
                provider = p;
            } catch {}
        }

        // Primary path (per Pyth docs): explicit provider + userContribution + gas limit.
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

        // Legacy fallback (older entropy contracts)
        if (sequenceNumber == 0) {
            try e.requestWithCallback{value: fee}(provider, userRandom) returns (uint64 seqLegacy) {
                sequenceNumber = seqLegacy;
            } catch {}
        }

        if (sequenceNumber == 0) revert EntropyDice__RoundNotReady();

        Round storage r = rounds[roundId];
        r.roundId = roundId;
        r.agent = agent;
        r.choice = choice;
        r.target = target;
        r.betAmount = betAmount;
        r.sequenceNumber = sequenceNumber;
        r.userRandom = userRandom;
        r.requestedAt = block.timestamp;
        r.state = RoundState.Requested;

        sequenceToRound[sequenceNumber] = roundId;

        emit EntropyRequested(roundId, sequenceNumber, agent, choice, target, betAmount, userRandom, fee);
    }

    function markSettled(bytes32 roundId) external onlyCasino {
        Round storage r = rounds[roundId];
        if (r.state != RoundState.Fulfilled) revert EntropyDice__RoundNotReady();
        r.state = RoundState.Settled;
        emit RoundStateChanged(roundId, RoundState.Settled);
    }

    function markExpired(bytes32 roundId) external onlyCasino {
        Round storage r = rounds[roundId];
        if (r.state != RoundState.Requested) revert EntropyDice__RoundNotReady();
        if (block.timestamp <= r.requestedAt + roundTtl) revert EntropyDice__RoundNotExpired();
        r.state = RoundState.Expired;
        emit RoundStateChanged(roundId, RoundState.Expired);
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

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

    function getRound(bytes32 roundId)
        external
        view
        returns (
            address agent,
            uint8 choice,
            uint8 target,
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
            r.choice,
            r.target,
            r.betAmount,
            r.sequenceNumber,
            r.userRandom,
            r.entropyRandom,
            r.requestedAt,
            r.fulfilledAt,
            r.state
        );
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setPaused(bool _paused) external onlyCasino {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setEntropyProvider(address _provider) external onlyCasino {
        if (_provider == address(0)) revert EntropyDice__ZeroProvider();
        entropyProvider = _provider;
        emit EntropyProviderUpdated(_provider);
    }

    function setEntropy(address _entropy) external onlyCasino {
        if (_entropy == address(0)) revert EntropyDice__ZeroEntropy();
        entropy = _entropy;
        emit EntropyAddressUpdated(_entropy);
    }

    function setCallbackGasLimit(uint32 _gasLimit) external onlyCasino {
        if (_gasLimit < 50_000 || _gasLimit > 5_000_000) revert EntropyDice__InvalidGasLimit();
        callbackGasLimit = _gasLimit;
        emit CallbackGasLimitUpdated(_gasLimit);
    }

    function setRoundTtl(uint256 _ttl) external onlyCasino {
        if (!(_ttl >= 30 seconds && _ttl <= 24 hours)) revert EntropyDice__InvalidTtl();
        roundTtl = _ttl;
        emit RoundTtlUpdated(_ttl);
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

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
