export const chainSpec = JSON.stringify({
  name: "Kreivo de Paseo",
  id: "kreivo",
  chainType: "Live",
  bootNodes: [
    "/dns/testnet.kreivo.io/tcp/443/wss/p2p/12D3KooWMsZKiQ8BJVaAxe9eFbiwx6QbJZ1kW2Zs2CxN7A1FGSR2",
    "/dns/testnet.kreivo.kippu.rocks/tcp/443/wss/p2p/12D3KooWJ9GyV1W5quD7M9MDQMLNaXPWF71v1xfFyH9F1YPH5uXt",
  ],
  properties: {
    ss58Format: 0,
    tokenDecimals: 10,
    tokenSymbol: "PAS",
  },
  relayChain: "paseo",
  paraId: 2281,
  consensusEngine: null,
  codeSubstitutes: {},
  genesis: {
    stateRootHash:
      "0x506d515020e5f923705d4ed88cf4205699052f4bd4698fe1dd7b20d1af2a0cdf",
  },
})
