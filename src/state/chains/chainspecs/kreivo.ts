export const chainSpec = JSON.stringify({
  name: "Kreivo",
  id: "kreivo",
  chainType: "Live",
  bootNodes: [
    "/dns/boot-1.kreivo.bloque.network/tcp/443/wss/p2p/12D3KooWEht3GDE23nGEhpyNgAJ6B2GiGT9hquBDko6PtWuFRRB8",
    "/dns/boot-2.kreivo.bloque.network/tcp/443/wss/p2p/12D3KooWLqz8Aj5g3snhLx2VZJzfAMNMZbwBrNs8LJGjY1ks4LcG",
    "/dns/boot-3.kreivo.bloque.network/tcp/443/wss/p2p/12D3KooWDAtFSYCotCmX5DtXTP2xsHvxtzfUSrVsgegFXopCzUBU",
    "/dns/boot.kreivo.kippu.rocks/tcp/443/wss/p2p/12D3KooWNpsPXUKvg9Gk9te54r4xodSPzVgLUkrfhDPpYXNepCb7"
  ],
  properties: {
    ss58Format: 2,
    tokenDecimals: 12,
    tokenSymbol: "KSM",
  },
  relayChain: "ksmcc3",
  paraId: 2281,
  consensusEngine: null,
  codeSubstitutes: {},
  genesis: {
    stateRootHash:
      "0x11f1914a3fd9087c3d211c83807ee7e6b48e948bd5e447bbe84c9302e8ccc2ff",
  },
})
