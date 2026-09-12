import { Settings } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Aneeverse OS Settings</h1>
        <p className="text-muted-foreground">Configuration area for auth, monitoring intervals, notifications, secrets, and future team permissions.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="size-5" /> MVP Settings</CardTitle>
            <CardDescription>Ahmad-only private access first. Employee roles come later.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">Auth pending</Badge>
            <Badge variant="outline">Monitoring pending</Badge>
            <Badge variant="outline">Notifications pending</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next Config</CardTitle>
            <CardDescription>Connect database, real VPS collector, and tool health checks.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We will keep using template-native cards, forms, tables, charts, and settings patterns while replacing demo data with real Aneeverse OS data.
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
