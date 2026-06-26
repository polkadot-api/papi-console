import { WhitelistEntriesByChain } from "@polkadot-api/descriptors"

export const whitelist: WhitelistEntriesByChain = {
  polkadot_people: [
    "query.Identity.IdentityOf",
    "query.Identity.SuperOf",
    "query.System.Account",
    "query.System.Number",
    "const.System.BlockLength",
    "const.System.BlockWeights",
    "const.Balances.ExistentialDeposit",
    "tx.Balances.transfer_keep_alive",
    "query.Session.Validators",
    "query.Session.CurrentIndex",
    "api.TransactionPaymentApi.query_info",
  ],
  dotAh: ["query.*", "tx.*", "const.*", "api.*"],
}
