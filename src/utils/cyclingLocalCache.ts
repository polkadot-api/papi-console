import { get, set } from "idb-keyval"

export const cyclingLocalCache = (key: string, limit = 10) => {
  const getCache = async () => {
    try {
      const entries = await get(key)
      return new Map<string, { time: number; data: string }>(entries)
    } catch (_) {
      return null
    }
  }
  const getCachedItem = (id: string) =>
    id === "metadata-cache"
      ? Promise.resolve(null)
      : getCache().then((cache) => cache?.get(id)?.data ?? null)
  const setCachedItem = async (id: string, data: string) => {
    const cached = await getCache()
    if (!cached) return

    cached.set(id, { time: Date.now(), data })
    if (cached.size > limit) {
      const oldest = [...cached.entries()].reduce((a, b) =>
        a[1].time < b[1].time ? a : b,
      )[0]
      cached.delete(oldest)
    }

    try {
      await set(key, [...cached.entries()])
    } catch (_) {
      /* empty */
    }
  }

  return [getCachedItem, setCachedItem] as const
}
