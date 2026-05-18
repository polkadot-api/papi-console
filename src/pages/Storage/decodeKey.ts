import { RuntimeContext } from "@polkadot-api/observable-client"
import { Twox128 } from "@polkadot-api/substrate-bindings"
import { fromHex, toHex } from "polkadot-api/utils"

const textEncoder = new TextEncoder()
const hashersToLength: Record<string, number> = {
  Identity: 0,
  Twox64Concat: 8,
  Blake2128Concat: 16,
  Blake2128: -16,
  Blake2256: -32,
  Twox128: -16,
  Twox256: -32,
}

export const decodeKey = (
  ctx: Pick<RuntimeContext, "lookup" | "dynamicBuilder">,
  key: Uint8Array,
) => {
  const twoxHash = (v: string) => toHex(Twox128(textEncoder.encode(v)))

  const keyHex = toHex(key)
  const pallet = ctx.lookup.metadata.pallets.find(
    (p) => p.storage && keyHex.startsWith(twoxHash(p.storage.prefix)),
  )
  if (!pallet) return null

  const keyRemaining = keyHex.replace(twoxHash(pallet.storage!.prefix), "0x")
  const item = pallet.storage!.items.find((v) =>
    keyRemaining.startsWith(twoxHash(v.name)),
  )
  if (!item) return null

  const codec = ctx.dynamicBuilder.buildStorage(pallet.name, item.name)
  const hasherLengths =
    item.type.tag === "plain"
      ? []
      : item.type.value.hashers.map((x) => hashersToLength[x.tag])

  let argsRemaining = fromHex(keyRemaining.replace(twoxHash(item.name), "0x"))

  const args: any[] = []
  const argsLen = codec.args.inner.length
  for (let i = 0; i < argsLen && argsRemaining.length; i++) {
    const hashLength = hasherLengths[i]

    if (argsRemaining.length < Math.abs(hashLength)) return null
    argsRemaining = argsRemaining.slice(Math.abs(hashLength))

    if (hashLength < 0) {
      // Signals a non-reversible hasher
      args.push(null)
    } else {
      const argCodec = codec.args.inner[i]
      try {
        const value = argCodec.dec(argsRemaining)
        // This is needed not just for the length, but see case AccountId: Can decode 0x, but then can't re-encode back. <- TODO bug?
        const reEnc = argCodec.enc(value)
        argsRemaining = argsRemaining.slice(reEnc.length)
        args.push(value)
      } catch {
        return null
      }
    }
  }

  return {
    pallet,
    item,
    entry: getEntry(ctx, item.type),
    args,
  }
}
export type DecodedKey = ReturnType<typeof decodeKey>

export const getEntry = (
  ctx: Pick<RuntimeContext, "lookup">,
  type:
    | {
        tag: "plain"
        value: number
      }
    | {
        tag: "map"
        value: {
          hashers: {
            tag: string
            value: undefined
          }[]
          key: number
          value: number
        }
      },
) => {
  if (type.tag === "plain") {
    return { value: type.value, keys: [] }
  }

  const value = type.value.value
  const hashers = type.value.hashers.map((x) => x.tag)
  if (hashers.length === 1) {
    return {
      value,
      keys: [
        {
          type: type.value.key,
          hasher: hashers[0],
        },
      ],
    }
  }

  const keyDef = ctx.lookup(type.value.key)
  if (keyDef.type === "array") {
    return {
      value,
      keys: hashers.map((hasher) => ({ type: keyDef.value.id, hasher })),
    }
  }
  if (keyDef.type === "tuple") {
    return {
      value,
      keys: hashers.map((hasher, i) => ({ type: keyDef.value[i].id, hasher })),
    }
  }
  throw new Error("Invalid key type " + keyDef.type)
}

export const getStorageItem = (
  ctx: Pick<RuntimeContext, "lookup">,
  palletName: string,
  itemName: string,
) => {
  const pallet = ctx.lookup.metadata.pallets.find((p) => p.name === palletName)
  if (!pallet?.storage) return null

  const item = pallet.storage.items.find((v) => v.name === itemName)
  if (!item) return null

  return { pallet, item }
}
