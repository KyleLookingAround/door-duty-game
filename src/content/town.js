// The town: streets, the rival firm, and why clients call back.
export const STREETS = [{ key: 'high', name: 'High Street', rep: 0 }, { key: 'market', name: 'Market Square', rep: 18 }, { key: 'riverside', name: 'Riverside', rep: 30 }];
// a rival firm starts bidding once the town is big enough to share
export const RIVAL = 'Brassworks Ltd';
export const CALLBACKS = {
  cold: 'A cold snap has the lobby freezing',
  hot: 'The heatwave has the lobby sweltering',
  busier: 'Footfall is up and the queue spills down the street',
  older: 'A new clinic upstairs brings an older crowd',
  botched: `${RIVAL} fitted cheap swing doors and the client regrets it`,
  safety: 'An inspector failed the entrance on safety: too many people clipped',
  access: 'An inspector failed the entrance: no step-free way in',
  study: 'Your market study found them wanting more: a bigger, busier entrance',
};
