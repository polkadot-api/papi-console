export const chainSpec = JSON.stringify({
  name: "Polkadot Bulletin",
  id: "bulletin-polkadot",
  chainType: "Live",
  bootNodes: [
    "/dns/bulletin.dpstk.de/tcp/30333/p2p/12D3KooWHPmACsPbXDo9n4qjBZqGEqJ7JLG2fvaCWNCMWyysg6vQ",
    "/dns/bulletin.amperfix.de/tcp/30333/p2p/12D3KooWMc7ZJ6JGiehG1H45JL69QTPivEBnzm8LihkEEFjYMRnr",
    "/dns/bulletin.dpstk.de/tcp/30335/wss/p2p/12D3KooWHPmACsPbXDo9n4qjBZqGEqJ7JLG2fvaCWNCMWyysg6vQ",
    "/dns/bulletin.amperfix.de/tcp/30335/wss/p2p/12D3KooWMc7ZJ6JGiehG1H45JL69QTPivEBnzm8LihkEEFjYMRnr",
  ],
  properties: {
    ss58Format: 0,
    tokenDecimals: 10,
    tokenSymbol: "DOT",
  },
  relay_chain: "polkadot",
  para_id: 1010,
  codeSubstitutes: {},
  genesis: {
    stateRootHash:
      "0x97b06f8b8861647a5cc2664d51362b9429302f9d44a0d2c05cc98735a11d6a05",
  },
})
