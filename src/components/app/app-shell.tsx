import type { ReactNode } from "react";
import { BriefcaseBusiness, ChartNoAxesColumn, Settings, Users } from "lucide-react";

import { NavLink } from "@/components/app/nav-link";
import { ThemeToggle } from "@/components/app/theme-toggle";

const navItems = [
  { href: "/", label: "Board", icon: BriefcaseBusiness },
  { href: "/metrics", label: "Metrics", icon: ChartNoAxesColumn },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/94 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-5">
          <div className="flex min-w-44 items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <BriefcaseBusiness className="size-4" />
            </div>
            <span className="text-base font-semibold tracking-normal">Applyline</span>
          </div>
          <nav className="flex flex-1 items-center gap-1" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink href={item.href} key={item.href}>
                <item.icon aria-hidden="true" className="size-4" />
                <span className="sr-only sm:not-sr-only">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="px-5 py-5">{children}</main>
    </div>
  );
}
