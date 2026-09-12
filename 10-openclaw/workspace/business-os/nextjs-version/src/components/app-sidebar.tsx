"use client"

import * as React from "react"
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Calendar,
  CheckSquare,
  CreditCard,
  DatabaseZap,
  HeartPulse,
  HelpCircle,
  LayoutDashboard,
  LayoutPanelLeft,
  LayoutTemplate,
  Mail,
  MessageCircle,
  Server,
  Settings,
  Shield,
  Users,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const oldTemplateItems = [
  { title: "Dashboard 1", url: "/old/dashboard" },
  { title: "Dashboard 2", url: "/old/dashboard-2" },
  { title: "Mail", url: "/mail" },
  { title: "Tasks", url: "/tasks" },
  { title: "Chat", url: "/chat" },
  { title: "Calendar", url: "/calendar" },
  { title: "Users", url: "/users" },
  { title: "Landing", url: "/landing" },
  { title: "FAQs", url: "/faqs" },
  { title: "Pricing", url: "/pricing" },
  { title: "Sign In 1", url: "/sign-in" },
  { title: "Sign In 2", url: "/sign-in-2" },
  { title: "Sign In 3", url: "/sign-in-3" },
  { title: "Sign Up 1", url: "/sign-up" },
  { title: "Sign Up 2", url: "/sign-up-2" },
  { title: "Sign Up 3", url: "/sign-up-3" },
  { title: "Forgot Password 1", url: "/forgot-password" },
  { title: "Forgot Password 2", url: "/forgot-password-2" },
  { title: "Forgot Password 3", url: "/forgot-password-3" },
  { title: "Unauthorized", url: "/errors/unauthorized" },
  { title: "Forbidden", url: "/errors/forbidden" },
  { title: "Not Found", url: "/errors/not-found" },
  { title: "Internal Server Error", url: "/errors/internal-server-error" },
  { title: "Under Maintenance", url: "/errors/under-maintenance" },
  { title: "User Settings", url: "/settings/user" },
  { title: "Account Settings", url: "/settings/account" },
  { title: "Plans & Billing", url: "/settings/billing" },
  { title: "Appearance", url: "/settings/appearance" },
  { title: "Notifications", url: "/settings/notifications" },
  { title: "Connections", url: "/settings/connections" },
]

const data = {
  user: {
    name: "Ahmad Anees",
    email: "anees@aneeverse.com",
    avatar: "",
  },
  navGroups: [
    {
      label: "Aneeverse OS",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "VPS Monitoring", url: "/vps-monitoring", icon: Server },
        { title: "Tools Directory", url: "/tools-directory", icon: Wrench },
        { title: "Tool Health", url: "/tool-health", icon: HeartPulse },
        { title: "Workflows", url: "/workflows", icon: DatabaseZap },
        { title: "Alerts & Logs", url: "/alerts-logs", icon: Bell },
        { title: "Settings", url: "/settings", icon: Settings },
      ],
    },
    {
      label: "Template",
      items: [
        {
          title: "Old",
          url: "#",
          icon: LayoutPanelLeft,
          items: oldTemplateItems,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Aneeverse OS</span>
                  <span className="truncate text-xs">Business Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
