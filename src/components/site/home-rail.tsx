"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareMore,
  Store,
  Users2,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiquidGlass } from "@/components/ui/LiquidGlass";

const sections = [
  { href: "#vue-generale", label: "Vue générale", icon: LayoutDashboard },
  { href: "#employes", label: "Employés IA", icon: Users2 },
  { href: "#technologies", label: "Technologies", icon: Cpu },
  { href: "#boutique", label: "Boutique", icon: Store },
  { href: "#controle", label: "Contrôle", icon: LockKeyhole },
  { href: "#clonechat", label: "CloneChat", icon: MessageSquareMore },
  { href: "#acces", label: "Accès", icon: Waypoints },
];

export default function HomeRail() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <LiquidGlass
      variant="panel"
      intensity="strong"
      refractive
      className={cn("cs-home-rail", collapsed && "cs-home-rail--collapsed")}
      aria-label="Navigation accueil CloneStore"
    >
      <div className="cs-home-rail__head">
        <div className="cs-home-rail__identity">
          <span className="cs-home-rail__spark" aria-hidden="true" />
          {!collapsed ? <span className="cs-home-rail__title">CloneStore</span> : null}
        </div>

        <button
          type="button"
          className="cs-home-rail__toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Déployer la navigation" : "Réduire la navigation"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="cs-home-rail__nav">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <a
              key={section.href}
              href={section.href}
              className="cs-home-rail__link"
              title={collapsed ? section.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{section.label}</span> : null}
            </a>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="cs-home-rail__foot">
          <p className="cs-home-rail__foot-title">OS d’employés IA</p>
          <p className="cs-home-rail__foot-text">
            Missions, exécution, mémoire, contrôle et traçabilité.
          </p>
        </div>
      ) : null}
    </LiquidGlass>
  );
}