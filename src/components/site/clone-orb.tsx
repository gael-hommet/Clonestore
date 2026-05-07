// src/components/site/clone-orb.tsx

import {
  Activity,
  BrainCircuit,
  DatabaseZap,
  Fingerprint,
  Orbit,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const signals = [
  { label: "CloneOS", icon: Orbit, tone: "blue" },
  { label: "CloneADN", icon: BrainCircuit, tone: "champagne" },
  { label: "CloneGuard", icon: ShieldCheck, tone: "green" },
  { label: "CloneTrace", icon: Workflow, tone: "violet" },
];

export default function CloneOrb() {
  return (
    <div className="cs-orb-shell" aria-label="Noyau visuel CloneStore">
      <div className="cs-orb-stage">
        <div className="cs-orb-ambient cs-orb-ambient--one" />
        <div className="cs-orb-ambient cs-orb-ambient--two" />
        <div className="cs-orb-ambient cs-orb-ambient--three" />

        <div className="cs-orb-grid" />

        <div className="cs-orb-ring cs-orb-ring--outer" />
        <div className="cs-orb-ring cs-orb-ring--middle" />
        <div className="cs-orb-ring cs-orb-ring--inner" />

        <div className="cs-orb-particles">
          <span className="cs-orb-particle cs-orb-particle--a" />
          <span className="cs-orb-particle cs-orb-particle--b" />
          <span className="cs-orb-particle cs-orb-particle--c" />
          <span className="cs-orb-particle cs-orb-particle--d" />
          <span className="cs-orb-particle cs-orb-particle--e" />
        </div>

        <div className="cs-orb-core">
          <div className="cs-orb-core__glass" />
          <div className="cs-orb-core__shine" />
          <div className="cs-orb-core__mist" />
          <div className="cs-orb-core__scan" />
          <div className="cs-orb-core__center">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="cs-orb-chip cs-orb-chip--top">
          <span className="cs-orb-chip__icon">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <span>Mission active</span>
        </div>

        <div className="cs-orb-chip cs-orb-chip--left">
          <span className="cs-orb-chip__icon">
            <Fingerprint className="h-3.5 w-3.5" />
          </span>
          <span>Mémoire entreprise</span>
        </div>

        <div className="cs-orb-chip cs-orb-chip--right">
          <span className="cs-orb-chip__icon">
            <DatabaseZap className="h-3.5 w-3.5" />
          </span>
          <span>Exécution tracée</span>
        </div>
      </div>

      <div className="cs-orb-signal-grid">
        {signals.map((signal) => {
          const Icon = signal.icon;

          return (
            <div
              key={signal.label}
              className={`cs-orb-signal cs-orb-signal--${signal.tone}`}
            >
              <Icon className="h-4 w-4" />
              <span>{signal.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}