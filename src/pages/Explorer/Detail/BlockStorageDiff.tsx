import { FC } from "react"
import { BlockInfo } from "../block.state"
import { Binary, Codec } from "polkadot-api"
import {
  HexString,
  Struct,
  Tuple,
  Twox128,
  u32,
  u64,
  u8,
  Vector,
} from "@polkadot-api/substrate-bindings"
import { state, useStateObservable } from "@react-rxjs/core"
import { dynamicBuilder$, lookup$ } from "@/state/chains/chain.state"
import { chopsticksInstance$ } from "@/chopsticks/chopsticks"
import { switchMap, map, combineLatest } from "rxjs"
import { toHex } from "@polkadot-api/utils"
import { groupBy } from "@/lib/groupBy"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { bytesToString } from "@/components/BinaryInput"
import { CopyText } from "@/components/Copy"
import { JsonDisplay } from "@/components/JsonDisplay"

const storageDiff$ = (hash: string) =>
  chopsticksInstance$.pipe(
    switchMap((chain) => {
      if (!chain) return [null]

      return chain.getBlock(hash as any)
    }),
    switchMap((block) => {
      if (!block) return [null]
      return block.storageDiff()
    }),
    map((v) =>
      v && Object.keys(v).length > 0
        ? (v as Record<string, string | null>)
        : null,
    ),
    // map((v) => v ?? testDiff),
  )

const TWOX128_LEN = 32

const blockDiff$ = state(
  (hash: string) =>
    // TODO for current block
    combineLatest([lookup$, dynamicBuilder$, storageDiff$(hash)]).pipe(
      map(([lookup, dynamicBuilder, diff]) => {
        if (!diff) return null

        const palletKeys = Object.fromEntries(
          lookup.metadata.pallets.map((pallet) => [
            toHex(Twox128(Binary.fromText(pallet.name).asBytes())).slice(2),
            {
              name: pallet.name,
              entries: Object.fromEntries(
                pallet.storage?.items.map((item) => [
                  toHex(Twox128(Binary.fromText(item.name).asBytes())).slice(2),
                  item.name,
                ]) ?? [],
              ),
            },
          ]),
        )

        return Object.entries(diff)
          .filter(([, newValue]) => newValue !== null)
          .map(
            ([key, newValue]): {
              key: HexString
              decodedKey: [string, ...unknown[]]
              newValue: HexString
              decodedNewValue: unknown
            } | null => {
              try {
                if (wellKnownKeys[key]) {
                  return {
                    key,
                    newValue: newValue!,
                    decodedKey: [wellKnownKeys[key].name],
                    decodedNewValue: wellKnownKeys[key].codec.dec(newValue!),
                  }
                }
                const pallet = palletKeys[key.slice(2, 2 + TWOX128_LEN)]
                if (pallet) {
                  const entry =
                    pallet.entries[
                      key.slice(2 + TWOX128_LEN, 2 + TWOX128_LEN * 2)
                    ]
                  const storageCodec =
                    entry && dynamicBuilder.buildStorage(pallet.name, entry)
                  if (storageCodec) {
                    return {
                      key,
                      newValue: newValue!,
                      decodedKey: [
                        pallet.name,
                        entry,
                        ...storageCodec.keys.dec(key),
                      ],
                      decodedNewValue: storageCodec.value.dec(newValue!),
                    }
                  }
                }
                console.warn("uknown key", key)
              } catch (ex) {
                console.error(ex)
              }
              return null
            },
          )
          .filter((v) => !!v)
      }),
      map((diffResult) => {
        if (!diffResult) return null
        const groups = groupBy(diffResult, (v) => v.decodedKey[0])

        return Object.entries(groups)
          .map(([name, group]) => ({
            name,
            changes: group.sort((a, b) => a.key.localeCompare(b.key)),
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      }),
    ),
  null,
)

export const BlockStorageDiff: FC<{
  block: BlockInfo
}> = ({ block }) => {
  const diff = useStateObservable(blockDiff$(block.hash))

  if (!diff) return null

  return (
    <Accordion type="multiple">
      {diff.map(({ name, changes }) => (
        <AccordionItem key={name} value={name}>
          <AccordionTrigger>{name}</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {changes.map((change) => (
              <div key={change.key}>
                <div>
                  <CopyText binary text={change.key} />{" "}
                  {change.decodedKey
                    .map((v) =>
                      typeof v === "object"
                        ? `(${JSON.stringify(v, (_, v) =>
                            typeof v === "bigint"
                              ? `${v}n`
                              : v instanceof Binary
                                ? bytesToString(v)
                                : v,
                          )})`
                        : String(v),
                    )
                    .join(".")}
                </div>
                <JsonDisplay collapsed src={change.decodedNewValue} />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

const strToHex = (v: string) => Binary.fromText(v).asHex()
const wellKnownKeys: Record<
  string,
  {
    name: string
    codec: Codec<any>
  }
> = {
  [strToHex(":code")]: {
    name: ":code",
    codec: Vector(u8),
  },
  [strToHex(":heappages")]: {
    name: ":heappages",
    codec: u64,
  },
  [strToHex(":extrinsic_index")]: {
    name: ":extrinsic_index",
    codec: u32,
  },
  [strToHex(":intrablock_entropy")]: {
    name: ":intrablock_entropy",
    codec: Vector(u8, 32),
  },
  [strToHex(":transaction_level:")]: {
    name: ":transaction_level:",
    codec: u32,
  },
  [strToHex(":grandpa_authorities")]: {
    name: ":grandpa_authorities",
    codec: Tuple(
      u8,
      Vector(
        Struct({
          id: Vector(u8, 32),
          weight: u64,
        }),
      ),
    ),
  },
}
