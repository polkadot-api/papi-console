import { FC } from "react"

const SIZE = 50
const STROKE_W = 4
const CENTER = SIZE / 2
const RADIUS = CENTER - STROKE_W
const PERIMTER = Math.PI * 2 * RADIUS
export const CircularProgress: FC<{
  text: string
  progress: number | null
}> = ({ text, progress }) => {
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <path
        d={`
          M${CENTER} ${STROKE_W}
          a ${RADIUS} ${RADIUS} 0 0 1 0 ${RADIUS * 2}
          a ${RADIUS} ${RADIUS} 0 0 1 0 -${RADIUS * 2}
        `}
        strokeWidth={STROKE_W}
        fill="transparent"
        className="transition-all ease-linear stroke-polkadot"
        opacity="0.3"
      />
      {progress ? (
        <path
          d={`
          M${CENTER} ${STROKE_W}
          a ${RADIUS} ${RADIUS} 0 0 1 0 ${RADIUS * 2}
          a ${RADIUS} ${RADIUS} 0 0 1 0 -${RADIUS * 2}
        `}
          strokeDasharray={`${progress * PERIMTER} ${PERIMTER}`}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all ease-linear stroke-polkadot"
          opacity="0.7"
        />
      ) : null}
      {progress && progress > 1 ? (
        <path
          d={`
          M${CENTER} ${STROKE_W}
          a ${RADIUS} ${RADIUS} 0 0 1 0 ${RADIUS * 2}
          a ${RADIUS} ${RADIUS} 0 0 1 0 -${RADIUS * 2}
        `}
          strokeDasharray={`${(progress - 1) * PERIMTER} ${PERIMTER}`}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all ease-linear stroke-polkadot"
        />
      ) : null}
      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dy=".3em"
        className="tabular-nums fill-foreground/80"
      >
        {text}
      </text>
    </svg>
  )
}
