import { OsTable } from "../aneeverse/components/os-table"
import { workflows } from "../aneeverse/data/os-data"

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Workflows / Automations</h1>
        <p className="text-muted-foreground">Inventory of n8n flows, scripts, bots, triggers, outputs, and last-run status.</p>
      </div>
      <OsTable
        title="Workflow Registry"
        description="Automation list using the template table pattern."
        columns={["Name", "Platform", "Trigger", "Status", "Last Run"]}
        rows={workflows.map((workflow) => ({
          Name: workflow.name,
          Platform: workflow.platform,
          Trigger: workflow.trigger,
          Status: workflow.status,
          "Last Run": workflow.lastRun,
        }))}
      />
    </div>
  )
}
