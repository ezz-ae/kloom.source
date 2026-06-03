"use client"

import { ResponsiveContainer, AreaChart, Area } from "recharts"
import { useMemo } from "react"

export function ActivitySparkline({ color = "#10b981", height = 30 }: { color?: string, height?: number }) {
  // Generate random stable data for the sparkline
  const data = useMemo(() => {
    const points = []
    let current = 50
    for (let i = 0; i < 20; i++) {
      current += Math.random() * 20 - 10
      points.push({ val: Math.max(10, Math.min(90, current)) })
    }
    return points
  }, [])

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#gradient-${color})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
