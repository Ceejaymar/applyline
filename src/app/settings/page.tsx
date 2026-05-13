import { Database, Keyboard, MonitorCog } from "lucide-react";

import { ThemeToggle } from "@/components/app/theme-toggle";

const settingsSections = [
  {
    title: "Theme",
    description: "Match system, light, or dark.",
    icon: MonitorCog,
    action: <ThemeToggle />,
  },
  {
    title: "Storage",
    description: "Applications are stored in this browser.",
    icon: Database,
    action: <span className="text-sm text-muted-foreground">IndexedDB</span>,
  },
  {
    title: "Input",
    description: "Drag cards by pointer or keyboard.",
    icon: Keyboard,
    action: <span className="text-sm text-muted-foreground">dnd-kit</span>,
  },
];

export default function SettingsPage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-normal">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace preferences.</p>
      </div>
      <div className="grid gap-3">
        {settingsSections.map((section) => (
          <section
            className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4"
            key={section.title}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary">
                <section.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{section.title}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </div>
            {section.action}
          </section>
        ))}
      </div>
    </div>
  );
}
