import { OsChartCard } from "../aneeverse/components/os-chart-card"
import { OsTable } from "../aneeverse/components/os-table"
import { tools } from "../aneeverse/data/os-data"

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Tool Health</h1>
        <p className="text-muted-foreground">Availability status for websites, APIs, bots, and automation systems.</p>
      </div>
      <OsChartCard />
      <OsTable
        title="Health Checks"
        description="Current placeholders. Next step is adding real URL/API checks."
        columns={["Name", "Category", "Health", "Status"]}
        rows={tools.map((tool) => ({ Name: tool.name, Category: tool.category, Health: tool.health, Status: tool.status }))}
      />
    </div>
  )
}
