import { OsTable } from "../aneeverse/components/os-table"
import { tools } from "../aneeverse/data/os-data"

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Tools Directory</h1>
        <p className="text-muted-foreground">Central inventory of business, technical, automation, and communication tools.</p>
      </div>
      <OsTable
        title="Tool Inventory"
        description="Initial list. We will add URLs, costs, owners, and credentials notes later."
        columns={["Name", "Category", "Purpose", "Status", "Health"]}
        rows={tools.map((tool) => ({
          Name: tool.name,
          Category: tool.category,
          Purpose: tool.purpose,
          Status: tool.status,
          Health: tool.health,
        }))}
      />
    </div>
  )
}
