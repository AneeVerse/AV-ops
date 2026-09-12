import { Terminal, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Page() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Terminal className="size-6" /> VPS Terminal
        </h1>
        <p className="text-muted-foreground">
          Terminal UI placeholder. Real shell access will be connected only after authentication is added.
        </p>
      </div>

      <Card className="border-yellow-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5" /> Protected terminal pending</CardTitle>
          <CardDescription>
            A live browser terminal gives direct shell access to the VPS. This preview is public and has no login yet, so I am not exposing a real shell here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">Authentication required before enabling</Badge>
        </CardContent>
      </Card>

      <Card className="overflow-hidden bg-black text-green-400">
        <CardHeader className="border-b border-green-500/20">
          <CardTitle className="font-mono text-base">srv1474915</CardTitle>
          <CardDescription className="text-green-400/70">Terminal preview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-4 font-mono text-sm">
          <div>$ ssh srv1474915</div>
          <div className="text-yellow-300">Access blocked: login/auth layer not configured.</div>
          <div className="text-green-400/70">Next step: add authentication, then connect secure terminal session.</div>
          <div className="animate-pulse">$ █</div>
        </CardContent>
      </Card>
    </div>
  )
}
