"use client";

// /demo — Header spécifique à la démonstration immersive.
// Le header global du site est masqué sur /demo (voir site-header.tsx). Ici : marque + label
// DÉMONSTRATION à gauche ; sortie + réservation à droite. AUCUNE navigation marketing concurrente.

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function DemoShellHeader({
  onReserve,
}: {
  onReserve?: () => void;
}) {
  return (
    <header className="demo-shell-header" aria-label="Démonstration CloneStore">
      <div className="demo-shell-header__brand">
        <span className="demo-shell-header__mark" aria-hidden="true">
          <svg viewBox="0 0 24 56" className="h-7 w-[13px]" fill="none">
            <rect x="3" y="3" width="18" height="50" rx="9" stroke="url(#demoMark)" strokeWidth="3.5" />
            <defs>
              <linearGradient id="demoMark" x1="3" y1="3" x2="21" y2="53">
                <stop stopColor="#7E97FF" />
                <stop offset="1" stopColor="#8E7AFF" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <span className="demo-shell-header__names">
          <span className="demo-shell-header__brandname">CloneStore</span>
          <span className="demo-shell-header__tag">Démonstration</span>
        </span>
      </div>

      <div className="demo-shell-header__actions">
        <Link href="/" className="demo-shell-header__exit">
          Quitter<span className="demo-shell-header__exit-full">&nbsp;la démo</span>
        </Link>
        <Link
          href="/reserver/pierre"
          onClick={onReserve}
          className="demo-shell-header__reserve"
        >
          <span>Réserver Pierre</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
