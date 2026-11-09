export type Weight = { ref_time: bigint; proof_size: bigint }

// Older runtimes (WeightV1, e.g. Kabocha) encode a weight as a single u64.
export const toWeight = (w: unknown): Weight | null => {
  if (w == null) return null
  if (typeof w === "bigint" || typeof w === "number")
    return { ref_time: BigInt(w), proof_size: 0n }
  return w as Weight
}

export const weightRatio = (a: bigint, b: bigint) =>
  b === 0n ? 0 : Number(a) / Number(b)
