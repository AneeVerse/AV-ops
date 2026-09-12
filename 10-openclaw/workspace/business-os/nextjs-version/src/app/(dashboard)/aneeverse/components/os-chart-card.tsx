"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartData = [
  { date: "May 12", vps: 84, tools: 72 },
  { date: "May 13", vps: 88, tools: 76 },
  { date: "May 14", vps: 81, tools: 74 },
  { date: "May 15", vps: 91, tools: 79 },
  { date: "May 16", vps: 86, tools: 82 },
  { date: "May 17", vps: 93, tools: 85 },
  { date: "May 18", vps: 90, tools: 80 },
]

const chartConfig = {
  vps: {
    label: "VPS",
    color: "var(--primary)",
  },
  tools: {
    label: "Tools",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function OsChartCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitoring Overview</CardTitle>
        <CardDescription>
          Placeholder uptime trend using the template chart component. Real checks come next.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillVps" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-vps)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-vps)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillTools" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-tools)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--color-tools)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area dataKey="tools" type="natural" fill="url(#fillTools)" stroke="var(--color-tools)" stackId="a" />
            <Area dataKey="vps" type="natural" fill="url(#fillVps)" stroke="var(--color-vps)" stackId="a" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
