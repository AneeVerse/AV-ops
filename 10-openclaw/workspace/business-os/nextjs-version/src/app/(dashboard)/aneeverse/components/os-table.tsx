import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function tone(value: string) {
  const lower = value.toLowerCase()
  if (["active", "online", "done"].some((word) => lower.includes(word))) return "default"
  if (["warning", "unknown", "pending", "planned", "process"].some((word) => lower.includes(word))) return "secondary"
  return "outline"
}

export function OsTable({
  title,
  description,
  columns,
  rows,
}: {
  title: string
  description: string
  columns: string[]
  rows: Record<string, string>[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${title}-${index}`}>
                  {columns.map((column) => {
                    const value = row[column] ?? "—"
                    const isStatus = ["Status", "Health", "Severity"].includes(column)
                    return (
                      <TableCell key={column}>
                        {isStatus ? <Badge variant={tone(value)}>{value}</Badge> : value}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
