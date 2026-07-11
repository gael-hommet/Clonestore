import { PierreCockpitConsole } from "@/components/cockpit/PierreCockpitConsole";
import { requireReadyClient } from "@/lib/clonestore/cloneos/require-ready-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireReadyClient(); return <PierreCockpitConsole view="overview" />; }
