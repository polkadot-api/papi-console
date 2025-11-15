import { Polkadot_peopleWhitelistEntry } from "@polkadot-api/descriptors"

export const whitelist: Polkadot_peopleWhitelistEntry[] = [
  "query.Identity.IdentityOf",
  "query.Identity.SuperOf",
  "query.System.Account",
  "tx.Balances.transfer_keep_alive",
  "query.Session.Validators",
  "query.Session.CurrentIndex",
]
