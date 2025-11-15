import { CopyText } from "@/components/Copy"
import { Link } from "@/hashParams"
import { client$ } from "@/state/chains/chain.state"
import { polkadot_people } from "@polkadot-api/descriptors"
import {
  _void,
  Bytes,
  HexString,
  Struct,
  u32,
  u64,
  Variant,
} from "@polkadot-api/substrate-bindings"
import { state, useStateObservable } from "@react-rxjs/core"
import { combineKeys } from "@react-rxjs/utils"
import { BlockHeader } from "polkadot-api"
import { AddressIdentity } from "polkahub"
import { FC, ReactNode } from "react"
import { filter, map, startWith, switchMap, take } from "rxjs"
import {
  BlockInfo,
  blockInfoState$,
  blocksByHeight$,
  BlockState,
} from "../block.state"
import { BlockStatusIcon, statusText } from "./BlockState"

export const BlockInfoView: FC<{
  block: BlockInfo
}> = ({ block }) => (
  <section className="space-y-4 px-4 py-2">
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight">
          #{block.number.toLocaleString()}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm font-mono text-foreground/90">
          <span className="truncate max-w-full">{block.hash}</span>
          <CopyText className="text-foreground/70" text={block.hash} binary />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <StatusChip state={block.status} />
      </div>
    </header>

    <div className="grid gap-4 md:grid-cols-2">
      <DetailTile label="Parent block">
        <BlockLink hash={block.parent} />
      </DetailTile>
      <DetailTile label="Children">
        <BlockChildren hash={block.hash} />
      </DetailTile>
    </div>

    {block.header && (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <DetailTile label="Roots">
          <HashPreview title="state" value={block.header.stateRoot} />
          <HashPreview title="extrinsic" value={block.header.extrinsicRoot} />
        </DetailTile>
        <DetailTile label="Block author">
          <Author hash={block.hash} header={block.header} />
        </DetailTile>
      </div>
    )}
  </section>
)

const StatusChip: FC<{ state: BlockState }> = ({ state }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/2 px-4 py-2 text-sm font-medium">
    <BlockStatusIcon size={20} state={state} />
    {statusText[state]}
  </span>
)

const HashPreview: FC<{ title: string; value: string }> = ({
  title,
  value,
}) => (
  <div className="font-mono text-sm">
    {title}: {value.slice(0, 18)}…
    <CopyText className="align-middle" text={value} binary />
  </div>
)

const DetailTile: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="rounded-xl border border-foreground/10 bg-foreground/2 p-4">
    <p className="text-xs uppercase tracking-widest text-foreground/60">
      {label}
    </p>
    <div className="mt-2 text-base text-muted-foreground">{children}</div>
  </div>
)

const validators$ = state(
  (block: HexString) =>
    client$.pipe(
      switchMap(async (client) => {
        try {
          return await client
            .getTypedApi(polkadot_people)
            .query.Session.Validators.getValue({
              at: block,
            })
        } catch (ex) {
          console.error(ex)
          return null
        }
      }),
    ),
  null,
)

const Author: FC<{ hash: HexString; header: BlockHeader }> = ({
  hash,
  header,
}) => {
  const validators = useStateObservable(validators$(hash))
  const idx = getAuthorityIdx(header)

  if (idx == null || validators == null) return <div className="h-10" />

  return (
    <AddressIdentity
      addr={validators[Number(idx % BigInt(validators.length))]}
    />
  )
}

const DigestWithVRF = Struct({
  authority_index: u32,
  slot: u64,
  vrf_signature: Struct({
    pre_output: Bytes(32),
    proof: Bytes(64),
  }),
})
const BabePreDigest = Variant({
  Uknown: _void,
  Primary: DigestWithVRF,
  SecondaryPlain: Struct({
    authority_index: u32,
    slot: u64,
  }),
  SecondaryVRF: DigestWithVRF,
})

const getAuthorityIdx = (header: BlockHeader) => {
  const preRuntime = header.digests.find((d) => d.type === "preRuntime")?.value

  switch (preRuntime?.engine) {
    case "BABE": {
      const babe = BabePreDigest.dec(preRuntime.payload)
      if (!babe.value) return null
      return BigInt(babe.value.authority_index)
    }
    case "aura": {
      return u64.dec(preRuntime.payload)
    }
  }

  return null
}

const childBlocks$ = state(
  (hash: string) =>
    blockInfoState$(hash).pipe(
      filter((v) => !!v),
      take(1),
      switchMap(({ hash, number }) =>
        combineKeys(
          blocksByHeight$.pipe(
            map((v) => v[number + 1]),
            map((v) =>
              v
                ? [...v.values()]
                    .filter((block) => block.parent === hash)
                    .map((block) => block.hash)
                : [],
            ),
          ),
          (hash) =>
            blockInfoState$(hash).pipe(
              filter((v) => !!v),
              startWith({ hash }),
            ),
        ),
      ),
      map((children) =>
        [...children.values()]
          .sort((a, b) => {
            const valueOf = (v: typeof a) =>
              "status" in v ? statusValue[v.status] : 0
            return valueOf(a) - valueOf(b)
          })
          .map((v) => v.hash),
      ),
    ),
  [],
)
const statusValue: Record<BlockState, number> = {
  [BlockState.Finalized]: 3,
  [BlockState.Best]: 2,
  [BlockState.Fork]: 1,
  [BlockState.Pruned]: 0,
  [BlockState.Unknown]: -1,
}

const BlockChildren: FC<{ hash: string }> = ({ hash }) => {
  const childBlocks = useStateObservable(childBlocks$(hash))

  return childBlocks.length ? (
    <span className="inline-flex gap-2 align-middle">
      {childBlocks.map((hash) => (
        <BlockLink key={hash} hash={hash} />
      ))}
    </span>
  ) : (
    <span className="text-slate-400">N/A</span>
  )
}

const BlockLink: FC<{ hash: string }> = ({ hash }) => {
  const block = useStateObservable(blockInfoState$(hash))

  if (!block) {
    return <span className="align-middle">{hash.slice(0, 12)}…</span>
  }

  return (
    <Link
      className="text-polkadot/70 hover:text-polkadot align-middle inline-flex items-center gap-1 underline"
      to={`../${hash}`}
    >
      {<BlockStatusIcon state={block.status} size={20} />}
      {hash.slice(0, 12)}…
    </Link>
  )
}
