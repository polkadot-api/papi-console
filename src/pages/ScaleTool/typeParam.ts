import { compressToBase64, decompressFromBase64 } from "lz-string"

export const encodeTypeParam = (type: string) =>
  compressToBase64(type)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")

export const decodeTypeParam = (value: string) => {
  try {
    const encoded = value.replaceAll("-", "+").replaceAll("_", "/")
    const base64 = encoded.padEnd(
      encoded.length + ((4 - (encoded.length % 4)) % 4),
      "=",
    )
    return decompressFromBase64(base64) ?? value
  } catch {
    // Let the type parser surface an error for malformed compressed links.
    return value
  }
}
