export const vpsServers = [
  {
    name: "srv1474915",
    provider: "Hostinger",
    purpose: "OpenClaw + operations services",
    status: "Online",
    cpu: "Pending",
    ram: "Pending",
    disk: "Pending",
    uptime: "Pending",
  },
]

export const tools = [
  { name: "OpenClaw", category: "AI / Ops", purpose: "Assistant + automations", status: "Active", health: "Online" },
  { name: "app.aneeverse.com", category: "Task OS", purpose: "Client → Request → Task system", status: "Active", health: "Unknown" },
  { name: "sales1.aneeverse.com", category: "CRM / ERP", purpose: "Sales CRM + Calling", status: "Active", health: "Unknown" },
  { name: "n8n", category: "Automation", purpose: "Workflow automation", status: "Active", health: "Unknown" },
  { name: "Telegram Bots", category: "Communication", purpose: "5 bot operations", status: "Active", health: "Unknown" },
]

export const workflows = [
  { name: "Hostinger VPS Snapshot", platform: "n8n", trigger: "Daily 03:00 IST", status: "Active", lastRun: "Pending" },
  { name: "Tool health checks", platform: "Aneeverse OS", trigger: "Scheduled later", status: "Planned", lastRun: "—" },
  { name: "VPS metric collector", platform: "Aneeverse OS", trigger: "Scheduled later", status: "Planned", lastRun: "—" },
]

export const alerts = [
  { severity: "Info", title: "Aneeverse OS template setup started", source: "Project", status: "Open" },
  { severity: "Warning", title: "Real health checks are not connected yet", source: "Monitoring", status: "Open" },
]

export const buildTasks = [
  { task: "Use Shadcn template as base", status: "Done", area: "Foundation" },
  { task: "Move old template tabs into Old dropdown", status: "Done", area: "Navigation" },
  { task: "Add Aneeverse OS main tabs", status: "Done", area: "Navigation" },
  { task: "Create dashboard placeholders using template components", status: "In Process", area: "MVP" },
  { task: "Connect real VPS monitoring", status: "Pending", area: "Monitoring" },
  { task: "Connect tool health checks", status: "Pending", area: "Monitoring" },
]
