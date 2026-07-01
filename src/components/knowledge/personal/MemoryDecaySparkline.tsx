import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { MemoryDecayPoint } from '@/types/knowledgeV2'

interface MemoryDecaySparklineProps {
  points: MemoryDecayPoint[]
  width?: number
  height?: number
}

export function MemoryDecaySparkline({
  points,
  width = 100,
  height = 30,
}: MemoryDecaySparklineProps) {
  const data = points.map((p) => ({
    index: p.snapshot_index,
    score: p.importance_score,
  }))

  if (data.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
      </svg>
    )
  }

  return (
    <div style={{ width, height }} className="text-primary">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="score"
            stroke="currentColor"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
