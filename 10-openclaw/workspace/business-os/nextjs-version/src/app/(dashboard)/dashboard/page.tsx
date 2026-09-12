import { OsChartCard } from "../aneeverse/components/os-chart-card"
import { OsSectionCards } from "../aneeverse/components/os-section-cards"
import { OsTable } from "../aneeverse/components/os-table"
import { buildTasks } from "../aneeverse/data/os-data"

export default function Page() {
  return (
    <>
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Aneeverse OS Dashboard</h1>
          <p className="text-muted-foreground">
            Central control center for VPS monitoring, tools, workflows, alerts, and progress tracking.
          </p>
        </div>
      </div>

      <div className="@container/main px-4 lg:px-6 space-y-6">
        <OsSectionCards />
        <OsChartCard />
        <OsTable
          title="Build Progress"
          description="Current implementation checklist for the Aneeverse OS MVP."
          columns={["Area", "Task", "Status"]}
          rows={buildTasks.map((item) => ({ Area: item.area, Task: item.task, Status: item.status }))}
        />
      </div>
    </>
  )
}
