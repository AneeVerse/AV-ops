import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { hostname, loadavg, platform, release, totalmem, freemem, uptime, cpus } from "node:os"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export const dynamic = "force-dynamic"

type HistoryPoint = {
  time: string
  cpu: number
  memory: number
  disk: number
  incomingRate: number
  outgoingRate: number
  bandwidthUsed: number
}

type NetworkSnapshot = {
  rxBytes: number
  txBytes: number
  timestamp: number
}

const globalState = globalThis as typeof globalThis & {
  __aneeverseVpsHistory?: HistoryPoint[]
  __aneeverseVpsNetworkLast?: NetworkSnapshot
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`
}

function bytesToMb(bytes: number) {
  return Number((bytes / 1024 / 1024).toFixed(2))
}

function bytesToTb(bytes: number) {
  return Number((bytes / 1024 / 1024 / 1024 / 1024).toFixed(4))
}

function formatDuration(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

async function getDiskUsage() {
  try {
    const { stdout } = await execFileAsync("df", ["-k", "/"])
    const lines = stdout.trim().split("\n")
    const parts = lines[1]?.trim().split(/\s+/)

    if (!parts || parts.length < 6) return null

    const totalKb = Number(parts[1])
    const usedKb = Number(parts[2])
    const availableKb = Number(parts[3])
    const percent = Math.round((usedKb / totalKb) * 100)

    return {
      total: formatBytes(totalKb * 1024),
      used: formatBytes(usedKb * 1024),
      available: formatBytes(availableKb * 1024),
      percent,
      mount: parts[5],
    }
  } catch {
    return null
  }
}

async function getIpAddress() {
  try {
    const { stdout } = await execFileAsync("hostname", ["-I"])
    return stdout.trim().split(/\s+/)[0] || "Unknown"
  } catch {
    return "Unknown"
  }
}

async function getOsName() {
  try {
    const { stdout } = await execFileAsync("bash", ["-lc", ". /etc/os-release && echo \"$PRETTY_NAME\""])
    return stdout.trim() || `${platform()} ${release()}`
  } catch {
    return `${platform()} ${release()}`
  }
}

async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  const raw = await readFile("/proc/net/dev", "utf8")
  let rxBytes = 0
  let txBytes = 0

  for (const line of raw.split("\n").slice(2)) {
    const [ifaceRaw, valuesRaw] = line.split(":")
    const iface = ifaceRaw?.trim()
    if (!iface || iface === "lo" || !valuesRaw) continue

    const values = valuesRaw.trim().split(/\s+/).map(Number)
    rxBytes += values[0] || 0
    txBytes += values[8] || 0
  }

  return { rxBytes, txBytes, timestamp: Date.now() }
}

function getCpuSnapshot() {
  const cores = cpus()
  const totals = cores.map((core) => {
    const total = Object.values(core.times).reduce((sum, value) => sum + value, 0)
    return { idle: core.times.idle, total }
  })

  const idle = totals.reduce((sum, item) => sum + item.idle, 0)
  const total = totals.reduce((sum, item) => sum + item.total, 0)
  const usedPercent = Math.round((1 - idle / total) * 100)

  return {
    cores: cores.length,
    model: cores[0]?.model ?? "Unknown CPU",
    usedPercent,
    loadAverage: loadavg().map((value) => Number(value.toFixed(2))),
  }
}

export async function GET() {
  const totalMemory = totalmem()
  const freeMemory = freemem()
  const usedMemory = totalMemory - freeMemory
  const memoryPercent = Math.round((usedMemory / totalMemory) * 100)
  const [disk, ipAddress, osName, networkNow] = await Promise.all([getDiskUsage(), getIpAddress(), getOsName(), getNetworkSnapshot()])
  const cpu = getCpuSnapshot()
  const now = new Date()

  const previousNetwork = globalState.__aneeverseVpsNetworkLast
  const elapsedSeconds = previousNetwork ? Math.max((networkNow.timestamp - previousNetwork.timestamp) / 1000, 1) : 1
  const incomingRateBytes = previousNetwork ? Math.max(networkNow.rxBytes - previousNetwork.rxBytes, 0) / elapsedSeconds : 0
  const outgoingRateBytes = previousNetwork ? Math.max(networkNow.txBytes - previousNetwork.txBytes, 0) / elapsedSeconds : 0
  const bandwidthUsedBytes = networkNow.rxBytes + networkNow.txBytes

  globalState.__aneeverseVpsNetworkLast = networkNow

  const history = globalState.__aneeverseVpsHistory ?? []
  history.push({
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }),
    cpu: cpu.usedPercent,
    memory: memoryPercent,
    disk: disk?.percent ?? 0,
    incomingRate: bytesToMb(incomingRateBytes),
    outgoingRate: bytesToMb(outgoingRateBytes),
    bandwidthUsed: bytesToTb(bandwidthUsedBytes),
  })
  globalState.__aneeverseVpsHistory = history.slice(-40)

  return Response.json({
    server: {
      name: hostname(),
      provider: "Hostinger",
      purpose: "OpenClaw + operations services",
      status: "Online",
      ipAddress,
      os: osName,
      osLogo: "https://hpanel.hostinger.com/assets/images/vpsOnboarding/ubuntu.svg",
      location: "India - Mumbai 2",
      plan: "KVM 2",
    },
    plan: {
      expirationDate: "2026-06-09",
      autoRenewal: "On",
    },
    cpu,
    memory: {
      total: formatBytes(totalMemory),
      used: formatBytes(usedMemory),
      free: formatBytes(freeMemory),
      percent: memoryPercent,
    },
    disk,
    network: {
      incomingRate: {
        bytesPerSecond: Math.round(incomingRateBytes),
        mbPerSecond: bytesToMb(incomingRateBytes),
        formatted: `${formatBytes(incomingRateBytes)}/s`,
      },
      outgoingRate: {
        bytesPerSecond: Math.round(outgoingRateBytes),
        mbPerSecond: bytesToMb(outgoingRateBytes),
        formatted: `${formatBytes(outgoingRateBytes)}/s`,
      },
      bandwidthUsed: {
        bytes: bandwidthUsedBytes,
        tb: bytesToTb(bandwidthUsedBytes),
        formatted: formatBytes(bandwidthUsedBytes),
      },
      rxTotal: formatBytes(networkNow.rxBytes),
      txTotal: formatBytes(networkNow.txBytes),
    },
    history: globalState.__aneeverseVpsHistory,
    uptime: {
      seconds: Math.floor(uptime()),
      formatted: formatDuration(uptime()),
    },
    checkedAt: now.toISOString(),
  })
}
