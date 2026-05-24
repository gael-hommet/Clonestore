// src/app/agents/pierre/use/components/PierreMobileActionBar.tsx
// Bottom navigation bar for mobile — Pierre Cockpit B31.1.
// Lucide icons only. No emojis.

import * as React from "react";
import {
  FileText,
  History,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PierreCockpitWorkspace } from "@/lib/pierre/cockpit/types";

type NavItem = {
  workspace: PierreCockpitWorkspace;
  icon: React.ReactNode;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { workspace: "mission",     icon: <Sparkles className="h-5 w-5" />,    label: "Mission"    },
  { workspace: "validations", icon: <ShieldCheck className="h-5 w-5" />, label: "Valider"    },
  { workspace: "documents",   icon: <FileText className="h-5 w-5" />,    label: "Documents"  },
  { workspace: "employees",   icon: <Users className="h-5 w-5" />,       label: "Salariés"   },
  { workspace: "value",       icon: <TrendingUp className="h-5 w-5" />,  label: "Valeur"     },
];

export function PierreMobileActionBar({
  activeWorkspace,
  onWorkspace,
}: {
  activeWorkspace: PierreCockpitWorkspace;
  onWorkspace: (ws: PierreCockpitWorkspace) => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t md:hidden"
      style={{
        background: "rgba(251, 247, 239, 0.94)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        borderColor: "var(--cs-line)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: 58,
      }}
      aria-label="Navigation principale"
    >
      {NAV_ITEMS.map((item) => {
        const active = activeWorkspace === item.workspace;
        return (
          <button
            key={item.workspace}
            onClick={() => onWorkspace(item.workspace)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            <span
              className={cn("transition-colors", active ? "" : "opacity-35")}
              style={{ color: active ? "var(--cs-graphite)" : "var(--cs-graphite)" }}
            >
              {item.icon}
            </span>
            <span
              className="text-[10px] font-semibold leading-tight"
              style={{
                color: active ? "var(--cs-ink-1)" : "var(--cs-ink-4)",
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
