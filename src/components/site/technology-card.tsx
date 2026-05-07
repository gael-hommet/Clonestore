import type { ReactNode } from "react";
import { LiquidGlass } from "@/components/ui/LiquidGlass";

type TechnologyCardProps = {
  name: string;
  title: string;
  text: string;
  icon: ReactNode;
};

export default function TechnologyCard({
  name,
  title,
  text,
  icon,
}: TechnologyCardProps) {
  return (
    <LiquidGlass
      variant="panel"
      intensity="medium"
      interactive
      className="cs-tech-card"
    >
      <div className="cs-tech-card__icon">{icon}</div>

      <div className="min-w-0">
        <p className="cs-tech-card__name">{name}</p>
        <h3 className="cs-tech-card__title">{title}</h3>
        <p className="cs-tech-card__text">{text}</p>
      </div>
    </LiquidGlass>
  );
}