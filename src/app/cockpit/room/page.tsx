// src/app/cockpit/room/page.tsx — P12 CloneRoom (salon). Gated; Suspense for useSearchParams.
import { Suspense } from "react";
import { CloneRoomConsole } from "@/components/cloneroom/CloneRoomConsole";
import { requireReadyClient } from "@/lib/clonestore/cloneos/require-ready-client";

export const dynamic = "force-dynamic";

export default async function CloneRoomPage() {
  await requireReadyClient();
  return (
    <Suspense fallback={<div className="cos-root" />}>
      <CloneRoomConsole />
    </Suspense>
  );
}
