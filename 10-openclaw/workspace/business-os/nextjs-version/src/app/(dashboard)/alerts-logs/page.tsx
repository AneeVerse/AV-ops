import { OsTable } from "../aneeverse/components/os-table"
import { alerts } from "../aneeverse/data/os-data"

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Alerts & Logs</h1>
        <p className="text-muted-foreground">Operational event history for downtime, workflow failures, monitoring warnings, and build notes.</p>
      </div>
      <OsTable
        title="Alert Log"
        description="This will become the central failure/warning log."
        columns={["Severity", "Title", "Source", "Status"]}
        rows={alerts.map((alert) => ({ Severity: alert.severity, Title: alert.title, Source: alert.source, Status: alert.status }))}
      />
    </div>
  )
}
