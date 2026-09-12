"use client"

import * as React from "react"
import Link from "next/link"
import { Copy, ExternalLink, Info, Pencil, RefreshCw, Terminal } from "lucide-react"
import { toast } from "sonner"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"

type HistoryPoint = {
  time: string
  cpu: number
  memory: number
  disk: number
  incomingRate: number
  outgoingRate: number
  bandwidthUsed: number
}

type VpsMetrics = {
  server: {
    name: string
    provider: string
    purpose: string
    status: string
    ipAddress: string
    os: string
    osLogo: string
    location: string
    plan: string
  }
  plan: { expirationDate: string; autoRenewal: string }
  cpu: { cores: number; model: string; usedPercent: number; loadAverage: number[] }
  memory: { total: string; used: string; free: string; percent: number }
  disk: null | { total: string; used: string; available: string; percent: number; mount: string }
  network: {
    incomingRate: { mbPerSecond: number; formatted: string }
    outgoingRate: { mbPerSecond: number; formatted: string }
    bandwidthUsed: { tb: number; formatted: string }
    rxTotal: string
    txTotal: string
  }
  history: HistoryPoint[]
  uptime: { seconds: number; formatted: string }
  checkedAt: string
}

const PURPLE = "#7c3aed"

const chartConfig = {
  value: {
    label: "Usage",
    color: PURPLE,
  },
} satisfies ChartConfig

function chartRows(history: HistoryPoint[] | undefined, key: keyof HistoryPoint) {
  const rows = (history ?? [])
    .map((item) => ({ time: item.time, value: Number(item[key]) || 0 }))
    .filter((item) => Number.isFinite(item.value))

  return rows.length ? rows : [{ time: "now", value: 0 }]
}

function TemplateMiniChart({
  history,
  metric,
  tooltipTitle,
  tooltipLines,
}: {
  history?: HistoryPoint[]
  metric: keyof HistoryPoint
  tooltipTitle?: string
  tooltipLines?: string[]
}) {
  return (
    <ChartContainer config={chartConfig} className="h-20 w-full min-w-[120px]">
      <AreaChart data={chartRows(history, metric)} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} hide />
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) => active ? (
            <div className="rounded-md border border-neutral-800 bg-black px-3 py-2 text-[11px] shadow-xl">
              <div className="mb-1 font-medium text-neutral-100">{payload?.[0]?.payload?.time ?? tooltipTitle}</div>
              {tooltipLines?.length ? (
                <div className="space-y-1 text-neutral-300">
                  {tooltipLines.map((line) => <div key={line}>{line}</div>)}
                </div>
              ) : (
                <div className="flex min-w-28 items-center gap-2 text-neutral-300">
                  <span className="size-2 rounded-[2px] bg-[#8b5cf6]" />
                  <span>{tooltipTitle}</span>
                  <span className="ml-auto font-semibold text-white">{payload?.[0]?.value}</span>
                </div>
              )}
            </div>
          ) : null}
        />
        <Area
          dataKey="value"
          type="natural"
          fill={`url(#fill-${metric})`}
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#8b5cf6", stroke: "#ffffff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function Ring({ percent = 0, label, tooltipLines }: { percent?: number; label?: string; tooltipLines?: string[] }) {
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference

  return (
    <div className="group relative flex size-16 items-center justify-center">
      <svg className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="5" fill="none" className="text-neutral-200 dark:text-neutral-800" />
        <circle cx="32" cy="32" r={radius} stroke="#7c3aed" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="absolute text-[10px] font-semibold text-muted-foreground">{Math.round(percent)}%</span>
      {tooltipLines?.length ? (
        <div className="pointer-events-none absolute left-0 top-1/2 z-50 hidden min-w-52 -translate-x-[calc(100%+12px)] -translate-y-1/2 rounded-md border border-neutral-800 bg-neutral-950 p-3 text-[11px] shadow-xl group-hover:block">
          <div className="mb-1 font-semibold text-neutral-100">{label}</div>
          <div className="space-y-1 text-neutral-300">
            {tooltipLines.map((line) => <div key={line}>{line}</div>)}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function UsageCard({
  title,
  value,
  suffix = "%",
  metric,
  history,
  detail,
  tooltipLines,
  ringPercent,
}: {
  title: string
  value: string | number
  suffix?: string
  metric?: keyof HistoryPoint
  history?: HistoryPoint[]
  detail?: string
  tooltipLines?: string[]
  ringPercent?: number
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <div className="mb-3 text-sm text-muted-foreground">{title} <span className="text-lg leading-none">›</span></div>
      <div className="flex min-h-16 items-center gap-4">
        <div className="min-w-[122px] text-3xl font-bold tracking-tight">
          {value}<span className="text-base font-medium text-muted-foreground">{suffix}</span>
          {detail ? <span className="ml-1 block text-xs font-medium text-muted-foreground">{detail}</span> : null}
        </div>
        <div className="flex-1">
          {typeof ringPercent === "number" ? (
            <div className="flex justify-end"><Ring percent={ringPercent} label={title} tooltipLines={tooltipLines} /></div>
          ) : metric ? (
            <TemplateMiniChart history={history} metric={metric} tooltipTitle={title} tooltipLines={tooltipLines} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
  } else {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }

  toast.success("Copied successfully")
}

function DetailCard({ title, rows }: { title: string; rows: { label: string; value: React.ReactNode; editable?: boolean; copyText?: string; info?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="px-5 py-4 text-sm font-semibold">{title}</div>
      <div className="divide-y">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-sm">
            <div className="text-muted-foreground">{row.label}</div>
            <div className="flex items-center gap-2 text-right font-medium">
              <span>{row.value}</span>
              {row.editable ? <Pencil className="size-4 text-purple-600" /> : null}
              {row.copyText ? (
                <button className="cursor-pointer text-purple-600 hover:text-purple-700" onClick={() => copyText(row.copyText!)} aria-label={`Copy ${row.label}`}>
                  <Copy className="size-4" />
                </button>
              ) : null}
              {row.info ? <Info className="size-4 text-muted-foreground" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VpsMonitoringClient() {
  const [data, setData] = React.useState<VpsMetrics | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadMetrics = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/vps/metrics", { cache: "no-store" })
      if (response.ok) setData(await response.json())
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadMetrics()
    const timer = window.setInterval(loadMetrics, 10000)
    return () => window.clearInterval(timer)
  }, [loadMetrics])

  const diskUsed = data?.disk?.used.split(" ")[0] ?? "—"
  const diskTotal = data?.disk?.total ?? "—"
  const bandwidthPercent = data ? Math.min((data.network.bandwidthUsed.tb / 8) * 100, 100) : 0
  const diskTooltipLines = [
    `Used: ${data?.disk?.used ?? "—"}`,
    `Total: ${data?.disk?.total ?? "—"}`,
    `Available: ${data?.disk?.available ?? "—"}`,
    `Mount: ${data?.disk?.mount ?? "/"}`,
    `Usage: ${data?.disk?.percent ?? "—"}%`,
  ]
  const bandwidthTooltipLines = [
    `Used: ${data?.network.bandwidthUsed.formatted ?? "—"}`,
    "Limit: 8 TB",
    `Usage: ${bandwidthPercent.toFixed(2)}%`,
    `Incoming total: ${data?.network.rxTotal ?? "—"}`,
    `Outgoing total: ${data?.network.txTotal ?? "—"}`,
  ]

  return (
    <div className="px-4 lg:px-6">
      <Card className="rounded-3xl border bg-white shadow-sm dark:bg-card">
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_auto] lg:items-start">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-orange-50">
                <img src={data?.server.osLogo || "https://hpanel.hostinger.com/assets/images/vpsOnboarding/ubuntu.svg"} alt="Ubuntu" className="size-9" />
              </div>
              <div>
                <div className="font-semibold">{data?.server.os || "Ubuntu"}</div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span>KVM {data?.cpu.cores ?? "—"}</span>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{data?.server.status ?? "Loading"}</Badge>
                </div>
              </div>
            </div>


            <div className="flex items-center gap-2 lg:justify-end">
              <Button asChild variant="outline" className="text-purple-700">
                <Link href="https://hpanel.hostinger.com/vps/1474915/overview" target="_blank" rel="noopener noreferrer"><ExternalLink />Hostinger</Link>
              </Button>
              <Button asChild variant="outline" className="text-purple-700">
                <Link href="/vps-monitoring/terminal" target="_blank"><Terminal />Terminal</Link>
              </Button>
              <Button variant="outline" size="icon" onClick={loadMetrics} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin" : ""} />
              </Button>

            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <UsageCard title="CPU usage" value={data?.cpu.usedPercent ?? "—"} history={data?.history} metric="cpu" />
            <UsageCard title="Memory usage" value={data?.memory.percent ?? "—"} history={data?.history} metric="memory" />
            <UsageCard
              title="Disk usage"
              value={diskUsed}
              suffix=" GB"
              detail={`/ ${diskTotal}`}
              ringPercent={data?.disk?.percent ?? 0}
              tooltipLines={diskTooltipLines}
            />
            <UsageCard title="Incoming traffic" value={data?.network.incomingRate.mbPerSecond ?? "—"} suffix=" MB/s" history={data?.history} metric="incomingRate" detail={`Total ${data?.network.rxTotal ?? "—"}`} />
            <UsageCard title="Outgoing traffic" value={data?.network.outgoingRate.mbPerSecond ?? "—"} suffix=" MB/s" history={data?.history} metric="outgoingRate" detail={`Total ${data?.network.txTotal ?? "—"}`} />
            <UsageCard
              title="Bandwidth"
              value={data?.network.bandwidthUsed.tb ?? "—"}
              suffix=" TB"
              detail={`/ 8 TB · ${data?.network.bandwidthUsed.formatted ?? "—"}`}
              ringPercent={bandwidthPercent}
              tooltipLines={bandwidthTooltipLines}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DetailCard
              title="VPS details"
              rows={[
                { label: "Server location", value: data?.server.location ?? "—", editable: true },
                { label: "OS", value: data?.server.os ?? "—", editable: true },
                { label: "Hostname", value: data?.server.name ?? "—", editable: true },
                { label: "VPS uptime", value: data?.uptime.formatted ?? "—" },
                { label: "SSH username", value: "root", copyText: "root" },
                { label: "IPv4", value: data?.server.ipAddress ?? "—", copyText: data?.server.ipAddress },
              ]}
            />
            <DetailCard
              title="Plan details"
              rows={[
                { label: "Current plan", value: data?.server.plan ?? "—" },
                { label: "Expiration date", value: data?.plan.expirationDate ?? "—" },
                { label: "Auto-renewal", value: data?.plan.autoRenewal ?? "—", info: true },
                { label: "CPU core", value: data?.cpu.cores ?? "—" },
                { label: "Memory", value: data?.memory.total ?? "—" },
                { label: "Disk space", value: data?.disk?.total ?? "—" },
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
