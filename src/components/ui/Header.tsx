import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import Mark from "./Mark";
import { Button } from "./button";

export default function Header() {
  return (
    <header className="relative z-20 w-full px-4 py-4">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-[1.8rem] border border-[var(--cs-line-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.70),rgba(255,255,255,0.48))] px-4 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-[18px]">
        <Link
          href="/"
          className="inline-flex items-center transition-opacity hover:opacity-95"
          aria-label="Retour Ã  lâ€™accueil CloneStore"
        >
          <Mark withWordmark />
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href="/assistant">
              <Bot className="h-4 w-4" />
              CloneChat
            </Link>
          </Button>

          <Button asChild>
            <Link href="/agents">
              Boutique
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}