'use client';

import { cn } from "@/lib/utils"
import { useMemo } from "react"
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from "@/components/ui/card"

interface SpendChartProps {
  className?: string
}

export default function SpendChart({ className }: SpendChartProps) {
  const spendData = useMemo(() => [
    { name: 'Mon', amount: 2400 },
    { name: 'Tue', amount: 1398 },
    { name: 'Wed', amount: 3200 },
    { name: 'Thu', amount: 2800 },
    { name: 'Fri', amount: 1908 },
    { name: 'Sat', amount: 2800 },
    { name: 'Sun', amount: 2400 },
  ], []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card className="bg-[#27272A] border-[#3F3F46] shadow-lg">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-white">{data.name}</p>
            <p className="text-xs text-gray-400">
              ${data.amount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className={cn("h-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={spendData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717A', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717A', fontSize: 12 }}
            tickFormatter={value => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#22C55E"
            strokeWidth={2}
            fill="url(#colorAmount)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
} 