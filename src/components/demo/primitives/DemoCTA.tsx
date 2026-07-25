"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CTAVariant = "primary" | "secondary" | "ghost";

function classesFor(variant: CTAVariant, hero: boolean): string {
  if (variant === "primary") return cn("demo-btn demo-btn-primary", hero && "demo-btn-primary--hero");
  if (variant === "secondary") return "demo-btn demo-btn-secondary";
  return "demo-btn demo-btn-ghost";
}

type CommonProps = {
  children: React.ReactNode;
  variant?: CTAVariant;
  hero?: boolean;
  withArrow?: boolean;
  className?: string;
};

/** Lien CTA (navigation interne). Le CTA principal porte data-demo-critical (QA cadrage). */
export function DemoCTALink({
  href,
  onClick,
  children,
  variant = "primary",
  hero = false,
  withArrow = false,
  className,
  prefetch,
}: CommonProps & {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      prefetch={prefetch}
      className={cn(classesFor(variant, hero), className)}
    >
      <span>{children}</span>
      {withArrow ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
    </Link>
  );
}

/** Bouton CTA (action sur la page). */
export function DemoCTAButton({
  onClick,
  children,
  variant = "primary",
  hero = false,
  withArrow = false,
  className,
  type = "button",
}: CommonProps & {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(classesFor(variant, hero), className)}
    >
      <span>{children}</span>
      {withArrow ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
    </button>
  );
}
