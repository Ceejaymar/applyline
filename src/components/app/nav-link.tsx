"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link>;

export function NavLink({ className, href, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const hrefValue = href.toString();
  const isActive = hrefValue === "/" ? pathname === "/" : pathname.startsWith(hrefValue);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        isActive && "bg-secondary text-foreground",
        className,
      )}
      href={href}
      {...props}
    />
  );
}
