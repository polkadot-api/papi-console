export const toSeconds = (value: number | null) =>
  value == null ? null : Math.max(0, value / 1000)

export const formatInteger = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : Math.round(value).toLocaleString()

export const formatBlockNumber = (value: number | null | undefined) =>
  value == null ? "-" : `#${value.toLocaleString()}`

export const shortHash = (hash: string) =>
  `${hash.slice(0, 8)}…${hash.slice(-6)}`

export const formatDuration = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : `${(value / 1000).toFixed(1)}s`

export const formatPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "-" : `${Math.round(value)}%`

export const nodeStatusText = (health: {
  isSyncing: boolean
  peers: number
}) => {
  if (health.isSyncing) return "node syncing"
  if (health.peers === 0) return "no peers"
  return "node healthy"
}
