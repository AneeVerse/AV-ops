import { Activity, AlertTriangle, Server, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { tools, vpsServers, workflows, alerts } from "../data/os-data"

export function OsSectionCards() {
  const cards = [
    {
      title: "VPS Servers",
      value: String(vpsServers.length),
      note: "Real server metrics connect next",
      icon: Server,
      badge: "MVP",
    },
    {
      title: "Tools Listed",
      value: String(tools.length),
      note: "Inventory started from known tools",
      icon: Wrench,
      badge: "+5",
    },
    {
      title: "Workflows",
      value: String(workflows.length),
      note: "Automation registry foundation",
      icon: Activity,
      badge: "+3",
    },
    {
      title: "Open Alerts",
      value: String(alerts.length),
      note: "Current warnings and build notes",
      icon: AlertTriangle,
      badge: "Watch",
    },
  ]

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card className="@container/card" key={card.title}>
          <CardHeader>
            <CardDescription>{card.title}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <card.icon />
                {card.badge}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              Aneeverse OS MVP
            </div>
            <div className="text-muted-foreground">{card.note}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
