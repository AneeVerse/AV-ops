"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/reminders", label: "Reminders" },
  { href: "/templates", label: "Templates" },
  { href: "/reports", label: "Reports" },
  { href: "/outreach", label: "Outreach" },
  { href: "/activity", label: "Activity" },
];

export function SalesShell({
  title,
  subtitle,
  children,
  headerActions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:h-screen xl:overflow-hidden">
      <aside className="hidden border-r border-[var(--border)] bg-[var(--sidebar)] px-3 py-3 lg:flex lg:flex-col lg:gap-3 xl:min-h-screen xl:overflow-hidden">
        <div className="rounded-2xl border border-[var(--border)] bg-white/[0.02] px-3 py-3">
          <div className="text-base font-semibold">Aneeverse Sales</div>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Revenue operating system</p>
        </div>

        <nav className="flex flex-col gap-1 overflow-auto pr-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 xl:flex xl:min-h-screen xl:flex-col xl:overflow-hidden">
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[rgba(15,17,21,.92)] px-4 py-3 backdrop-blur md:px-5 xl:shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-5">{title}</h1>
              {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
            </div>
            {headerActions ? <div className="flex flex-wrap justify-end gap-1.5">{headerActions}</div> : null}
          </div>
        </header>
        <div className="grid gap-3 px-4 py-3 md:px-5 xl:min-h-0 xl:flex-1 xl:overflow-auto">{children}</div>
      </main>
    </div>
  );
}
