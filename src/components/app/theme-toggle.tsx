"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const nextTheme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const label = `Switch to ${nextTheme} theme`;

  return (
    <Button
      aria-label={label}
      className="shrink-0"
      onClick={() => setTheme(nextTheme)}
      size="icon"
      title={label}
      variant="outline"
    >
      {mounted && theme === "light" ? <Sun /> : null}
      {mounted && theme === "dark" ? <Moon /> : null}
      {!mounted || theme === "system" ? <Monitor /> : null}
    </Button>
  );
}
