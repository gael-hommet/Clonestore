"use client";
// src/components/clonechat/SafeText.tsx
// C1.8 FINAL §7 — Rend un texte de réponse avec des LIENS RÉELLEMENT CLIQUABLES.
//
// Le découpage est fait par un module PUR (`safe-links.ts`) qui renvoie des DONNÉES.
// Aucun `dangerouslySetInnerHTML`, aucune chaîne de balisage : il est donc structurellement
// impossible d'injecter du HTML ou du JavaScript via la réponse du modèle.
//
// Les routes internes passent par le REGISTRE canonique : une route inventée par le modèle
// n'est pas transformée en lien, elle reste du texte. Un lien mort est pire qu'une adresse brute.

import Link from "next/link";
import { parseSafeLinks } from "@/lib/clonechat/links/safe-links";

export function SafeText({ text }: { text: string }) {
  const segments = parseSafeLinks(text);

  return (
    <>
      {segments.map((s, i) => {
        if (s.kind === "internal") {
          return (
            <Link
              key={i}
              href={s.href}
              className="cc-inline-link"
              // Le libellé accessible est le libellé HUMAIN, jamais l'URL brute.
              aria-label={s.label}
            >
              {s.label}
            </Link>
          );
        }
        if (s.kind === "external") {
          return (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cc-inline-link"
              aria-label={s.label}
            >
              {s.label}
            </a>
          );
        }
        return <span key={i}>{s.text}</span>;
      })}
    </>
  );
}
