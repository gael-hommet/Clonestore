"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  status?: string | null;
  riskLevel?: string | null;
  className?: string;
};

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function getStatusMeta(statusRaw?: string | null) {
  const status = normalize(statusRaw);

  switch (status) {
    case "awaiting_info":
      return {
        label: "En attente d’info",
        className: "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]",
        icon: CircleHelp,
      };
    case "awaiting_validation":
    case "awaiting_approval":
      return {
        label: "Validation requise",
        className: "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]",
        icon: ShieldAlert,
      };
    case "planned":
      return {
        label: "Planifiée",
        className: "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]",
        icon: Clock3,
      };
    case "ready":
    case "queued":
      return {
        label: "Prête",
        className: "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]",
        icon: Clock3,
      };
    case "running":
    case "in_progress":
      return {
        label: "En cours",
        className: "border-[#d8e1ef] bg-[#f5f8fd] text-[#425f8c]",
        icon: Loader2,
        spin: true,
      };
    case "done":
    case "completed":
      return {
        label: "Terminée",
        className: "border-[#d7e8da] bg-[#edf8ef] text-[#2f6c43]",
        icon: CheckCircle2,
      };
    case "retry":
      return {
        label: "À relancer",
        className: "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]",
        icon: Clock3,
      };
    case "blocked":
    case "failed":
      return {
        label: "Bloquée",
        className: "border-[#f0c2bc] bg-[#fff1ef] text-[#8b3d33]",
        icon: AlertTriangle,
      };
    case "cancelled":
      return {
        label: "Annulée",
        className: "border-[#eadbc9] bg-[#faf7f2] text-[#7b6b59]",
        icon: XCircle,
      };
    case "draft":
      return {
        label: "Brouillon",
        className: "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]",
        icon: Clock3,
      };
    case "idle":
      return {
        label: "Inactive",
        className: "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]",
        icon: Clock3,
      };
    default:
      return {
        label: statusRaw?.trim() ? statusRaw : "Statut",
        className: "border-[#eadbc9] bg-[#fffdf8] text-[#735f4b]",
        icon: Clock3,
      };
  }
}

function getRiskTone(riskRaw?: string | null) {
  const risk = normalize(riskRaw);

  switch (risk) {
    case "critical":
      return "border-[#f0c2bc] bg-[#fff1ef] text-[#8b3d33]";
    case "sensitive":
      return "border-[#ecd8b4] bg-[#fff8ea] text-[#8a5b17]";
    default:
      return "border-[#d7e8da] bg-[#edf8ef] text-[#2f6c43]";
  }
}

export function PierreStatusBadge({ status, riskLevel, className }: Props) {
  const statusMeta = getStatusMeta(status);
  const Icon = statusMeta.icon;
  const showRisk = Boolean(riskLevel && normalize(riskLevel) !== "normal");

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
          statusMeta.className
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", statusMeta.spin && "animate-spin")} />
        {statusMeta.label}
      </span>

      {showRisk && (
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
            getRiskTone(riskLevel)
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Risque : {riskLevel}
        </span>
      )}
    </div>
  );
}

export default PierreStatusBadge;