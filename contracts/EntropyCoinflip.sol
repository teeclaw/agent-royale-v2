// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CasinoOwnable.sol";

interface IEntropy {
    function getFee(address provider) external view returns (uint256);
    function requestWithCallback(address provider, bytes32 userRandomNumber) external payable returns (uint64);
}

abstract contract EntropyConsumer {
    error OnlyEntropy();

    address public entropy;

    constructor(address _entropy) {
        require(_entropy != address(0), "entropy=0");
        entropy = _entropy;
    }

    function entropyCallback(uint64 sequenceNumber, address provider, bytes32 entropyRandomNumber) external {
        if (msg.sender != entropy) revert OnlyEntropy();
        _entropyCallback(sequenceNumber, provider, entropyRandomNumber);
    }

    function _entropyCallback(uint64 sequenceNumber, address provider, bytes32 entropyRandomNumber) internal virtual;
}

contract EntropyCoinflip is CasinoOwnable, EntropyConsumer {
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
        uint8 choice; // 0=heads, 1=tails
        uint256 betAmount;
        uint64 sequenceNumber;
        bytes32 userRandom;
        bytes32 entropyRandom;
        uint256 requestedAt;
        uint256 fulfilledAt;
        RoundState state;
    }

    mapping(bytes32 => Round) public rounds;
    mapping(uint64 => bytes32) public sequenceToRound;

    address public entropyProvider;
    uint256 public roundTtl = 5 minutes;
    bool public paused;

    event EntropyProviderUpdated(address indexed provider);
    event EntropyAddressUpdated(address indexed entropyAddress);
    event RoundTtlUpdated(uint256 ttl);
    event PausedSet(bool paused);

    event EntropyRequested(
        bytes32 indexed roundId,
        uint64 indexed sequenceNumber,
        address indexed agent,
        uint8 choice,
        uint256 betAmount,
        bytes32 userRandom,
        uint256 fee
    );
    event EntropyFulfilled(bytes32 indexed roundId, uint64 indexed sequenceNumber, bytes32 entropyRandom);
    event RoundStateChanged(bytes32 indexed roundId, RoundState state);

    error InvalidRound();
    error InvalidChoice();
    error AlreadyExists();
    error RoundNotReady();
    error RoundExpired();
    error RoundPaused();

    modifier notPaused() {
        if (paused) revert RoundPaused();
        _;
    }

    constructor(address _casino, address _entropy, address _entropyProvider)
        CasinoOwnable(_casino)
        EntropyConsumer(_entropy)
    {
        require(_entropyProvider != address(0), "provider=0");
        entropyProvider = _entropyProvider;
    }

    function setPaused(bool _paused) external onlyCasino {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setEntropyProvider(address _provider) external onlyCasino {
        require(_provider != address(0), "provider=0");
        entropyProvider = _provider;
        emit EntropyProviderUpdated(_provider);
    }

    function setEntropy(address _entropy) external onlyCasino {
        require(_entropy != address(0), "entropy=0");
        entropy = _entropy;
        emit EntropyAddressUpdated(_entropy);
    }

    function setRoundTtl(uint256 _ttl) external onlyCasino {
        require(_ttl >= 30 seconds && _ttl <= 24 hours, "ttl range");
        roundTtl = _ttl;
        emit RoundTtlUpdated(_ttl);
    }

    function quoteFee() public view returns (uint256) {
        return IEntropy(entropy).getFee(entropyProvider);
    }

    function requestCoinflip(
        bytes32 roundId,
        address agent,
        uint8 choice,
        uint256 betAmount,
        bytes32 userRandom
    ) external payable onlyCasino notPaused returns (uint64 sequenceNumber) {
        if (roundId == bytes32(0) || agent == address(0)) revert InvalidRound();
        if (choice > 1) revert InvalidChoice();
        if (rounds[roundId].state != RoundState.None) revert AlreadyExists();

        uint256 fee = quoteFee();
        require(msg.value >= fee, "fee too low");

        sequenceNumber = IEntropy(entropy).requestWithCallback{value: fee}(entropyProvider, userRandom);

        Round storage r = rounds[roundId];
        r.roundId = roundId;
        r.agent = agent;
        r.choice = choice;
        r.betAmount = betAmount;
        r.sequenceNumber = sequenceNumber;
        r.userRandom = userRandom;
        r.requestedAt = block.timestamp;
        r.state = RoundState.Requested;

        sequenceToRound[sequenceNumber] = roundId;

        emit EntropyRequested(roundId, sequenceNumber, agent, choice, betAmount, userRandom, fee);
    }

    function _entropyCallback(uint64 sequenceNumber, address provider, bytes32 entropyRandomNumber) internal override {
        if (provider != entropyProvider) return;

        bytes32 roundId = sequenceToRound[sequenceNumber];
        if (roundId == bytes32(0)) return;

        Round storage r = rounds[roundId];
        if (r.state != RoundState.Requested) return;

        r.entropyRandom = entropyRandomNumber;
        r.fulfilledAt = block.timestamp;
        r.state = RoundState.Fulfilled;

        emit EntropyFulfilled(roundId, sequenceNumber, entropyRandomNumber);
    }

    function markSettled(bytes32 roundId) external onlyCasino {
        Round storage r = rounds[roundId];
        if (r.state != RoundState.Fulfilled) revert RoundNotReady();
        r.state = RoundState.Settled;
        emit RoundStateChanged(roundId, RoundState.Settled);
    }

    function markExpired(bytes32 roundId) external onlyCasino {
        Round storage r = rounds[roundId];
        if (r.state != RoundState.Requested) revert RoundNotReady();
        if (block.timestamp <= r.requestedAt + roundTtl) revert RoundExpired();
        r.state = RoundState.Expired;
        emit RoundStateChanged(roundId, RoundState.Expired);
    }

    function getRound(bytes32 roundId)
        external
        view
        returns (
            address agent,
            uint8 choice,
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
            r.betAmount,
            r.sequenceNumber,
            r.userRandom,
            r.entropyRandom,
            r.requestedAt,
            r.fulfilledAt,
            r.state
        );
    }
}
