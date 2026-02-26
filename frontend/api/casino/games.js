module.exports = async (req, res) => {
  res.status(200).json({
    slots: { name: 'slots', displayName: 'Agent Slots', rtp: '95.0%', houseEdge: '5.0%', maxMultiplier: 290, minBet: '0.0001 Ξ', randomness: 'Pyth Entropy', description: '3-reel slot machine. Verifiable onchain randomness.' },
    coinflip: { name: 'coinflip', displayName: 'Agent Coinflip', rtp: '95.0%', houseEdge: '5.0%', payout: '1.9x', minBet: '0.0001 Ξ', randomness: 'Pyth Entropy', description: 'Heads or tails. Verifiable onchain randomness.' },
    dice: { name: 'dice', displayName: 'Agent Dice', rtp: '95.0%', houseEdge: '5.0%', targetRange: '1-99', dynamicMultiplier: true, minBet: '0.0001 Ξ', randomness: 'Pyth Entropy', description: 'Roll over or under. You choose the risk and reward.' },
    lotto: { name: 'lotto', displayName: 'Agent Lotto', rtp: '85.0%', houseEdge: '15.0%', ticketPrice: '0.001 Ξ', payoutMultiplier: '85x', randomness: 'Pyth Entropy', description: 'Pick 1-100. Scheduled draws every 6 hours. Verifiable onchain randomness.' },
  });
};
