"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BriefcaseBusiness,
  LayoutDashboard,
  Settings2,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
};

function NavItem({ href, label, icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
        active
          ? "bg-[rgba(111,99,246,0.12)] text-[var(--cs-violet)] shadow-[inset_0_0_0_1px_rgba(111,99,246,0.14)]"
          : "text-[var(--cs-ink-3)] hover:bg-white/62 hover:text-[var(--cs-ink-1)]",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <section className="cs-panel rounded-[1.8rem] p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <NavItem
              href="/profile"
              label="Mon espace"
              icon={<LayoutDashboard className="h-4 w-4" />}
              active={isActive(pathname, "/profile")}
            />
            <NavItem
              href="/profile/agents"
              label="Mes employés"
              icon={<BriefcaseBusiness className="h-4 w-4" />}
              active={isActive(pathname, "/profile/agents")}
            />
            <NavItem
              href="/agents/pierre/setup"
              label="Configuration Pierre"
              icon={<Settings2 className="h-4 w-4" />}
              active={isActive(pathname, "/agents/pierre/setup")}
            />
            <NavItem
              href="/assistant"
              label="CloneChat"
              icon={<Bot className="h-4 w-4" />}
              active={isActive(pathname, "/assistant")}
            />
            <NavItem
              href="/agents"
              label="Boutique"
              icon={<Sparkles className="h-4 w-4" />}
              active={isActive(pathname, "/agents")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--cs-line-soft)] pt-3">
            <Link
              href="/agents/pierre/use"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--cs-violet)_18%,white)] bg-[rgba(111,99,246,0.08)] px-4 text-[0.82rem] font-medium text-[var(--cs-violet)] transition hover:bg-[rgba(111,99,246,0.12)]"
            >
              <Waypoints className="h-4 w-4" />
              Utiliser Pierre
            </Link>

            <span className="cs-status cs-status--info">
              Cockpit privé CloneStore
            </span>
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}