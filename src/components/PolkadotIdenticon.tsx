// Based from https://github.com/paritytech/oo7/blob/251ba2b7c45503b68eab4320c270b5afa9bccb60/packages/polkadot-identicon/src/index.jsx

import { blake2b } from "@noble/hashes/blake2"
import { FC, SVGAttributes } from "react"

export const PolkadotIdenticon: FC<
  Omit<SVGAttributes<SVGElement>, "viewBox"> & {
    sixPoint?: boolean
    publicKey: Uint8Array | null
    size?: number
  }
> = ({ sixPoint, publicKey, ...props }) => {
  const svgProps = {
    ...props,
    width: props.size ?? props.width ?? SIZE,
    height: props.size ?? props.height ?? SIZE,
    viewBox: `0 0 ${SIZE} ${SIZE}`,
  }
  if (!publicKey) {
    return (
      <svg {...svgProps}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill="#eee" />
      </svg>
    )
  }

  const colors = getColors(publicKey)
  const circles = getPositions(sixPoint)

  return (
    <svg {...svgProps}>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill="#eee" />
      {circles.map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r={z} fill={colors[i]} />
      ))}
    </svg>
  )
}

const SIZE = 64
const CENTER = SIZE / 2

const z = (SIZE / 64) * 5
type Schema = { freq: number; colors: number[] }
const schema: Record<string, Schema> = {
  target: {
    freq: 1,
    colors: [0, 28, 0, 0, 28, 0, 0, 28, 0, 0, 28, 0, 0, 28, 0, 0, 28, 0, 1],
  },
  cube: {
    freq: 20,
    colors: [0, 1, 3, 2, 4, 3, 0, 1, 3, 2, 4, 3, 0, 1, 3, 2, 4, 3, 5],
  },
  quazar: {
    freq: 16,
    colors: [1, 2, 3, 1, 2, 4, 5, 5, 4, 1, 2, 3, 1, 2, 4, 5, 5, 4, 0],
  },
  flower: {
    freq: 32,
    colors: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 3],
  },
  cyclic: {
    freq: 32,
    colors: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 6],
  },
  vmirror: {
    freq: 128,
    colors: [0, 1, 2, 3, 4, 5, 3, 4, 2, 0, 1, 6, 7, 8, 9, 7, 8, 6, 10],
  },
  hmirror: {
    freq: 128,
    colors: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 8, 6, 7, 5, 3, 4, 2, 11],
  },
}
const totalFreq = Object.keys(schema)
  .map((k) => schema[k].freq)
  .reduce((a, b) => a + b)

const findScheme = (d: number) => {
  let cum = 0
  for (const scheme of Object.values(schema)) {
    cum += scheme.freq
    if (d < cum) {
      return scheme
    }
  }
  throw "Unreachable"
}
const blake2512 = (input: Uint8Array) => blake2b(input, { dkLen: 64 })
const zero = blake2512(
  new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]),
)

const getColors = (publicKey: Uint8Array) => {
  const id = Array.from(blake2512(publicKey)).map(
    (x, i) => (x + 256 - zero[i]) % 256,
  )

  const sat = (Math.floor((id[29] * 70) / 256 + 26) % 80) + 30
  const d = Math.floor((id[30] + id[31] * 256) % totalFreq)
  const scheme = findScheme(d)
  const palette = Array.from(id).map((x, i) => {
    const b = (x + (i % 28) * 58) % 256
    if (b == 0) {
      return "#444"
    }
    if (b == 255) {
      return "transparent"
    }
    const h = Math.floor(((b % 64) * 360) / 64)
    const l = [53, 15, 35, 75][Math.floor(b / 64)]
    return `hsl(${h}, ${sat}%, ${l}%)`
  })

  const rot = (id[28] % 6) * 3

  return scheme.colors.map(
    (_, i) => palette[scheme.colors[i < 18 ? (i + rot) % 18 : 18]],
  )
}

const getPositions = (sixPoint = false) => {
  const r = sixPoint ? (SIZE / 2 / 8) * 5 : (SIZE / 2 / 4) * 3
  const rroot3o2 = (r * Math.sqrt(3)) / 2
  const ro2 = r / 2
  const rroot3o4 = (r * Math.sqrt(3)) / 4
  const ro4 = r / 4
  const r3o4 = (r * 3) / 4

  return [
    { x: CENTER, y: CENTER - r },
    { x: CENTER, y: CENTER - ro2 },
    { x: CENTER - rroot3o4, y: CENTER - r3o4 },
    { x: CENTER - rroot3o2, y: CENTER - ro2 },
    { x: CENTER - rroot3o4, y: CENTER - ro4 },
    { x: CENTER - rroot3o2, y: CENTER },
    { x: CENTER - rroot3o2, y: CENTER + ro2 },
    { x: CENTER - rroot3o4, y: CENTER + ro4 },
    { x: CENTER - rroot3o4, y: CENTER + r3o4 },
    { x: CENTER, y: CENTER + r },
    { x: CENTER, y: CENTER + ro2 },
    { x: CENTER + rroot3o4, y: CENTER + r3o4 },
    { x: CENTER + rroot3o2, y: CENTER + ro2 },
    { x: CENTER + rroot3o4, y: CENTER + ro4 },
    { x: CENTER + rroot3o2, y: CENTER },
    { x: CENTER + rroot3o2, y: CENTER - ro2 },
    { x: CENTER + rroot3o4, y: CENTER - ro4 },
    { x: CENTER + rroot3o4, y: CENTER - r3o4 },
    { x: CENTER, y: CENTER },
  ]
}
