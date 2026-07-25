"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isPwaAutoInvitePath } from "@/lib/pwa/detect";
import { usePwa } from "./use-pwa";
import { PwaContext } from "./pwa-context";
import { InstallPrompt } from "./InstallPrompt";
import { IosInstallSheet } from "./IosInstallSheet";
import { UpdateToast } from "./UpdateToast";

/**
 * Fournit l'état PWA à tout l'arbre (une seule instance de usePwa ⇒ un seul SW enregistré)
 * et rend les surfaces flottantes non agressives : proposition d'installation, feuille iOS,
 * bandeau de mise à jour. Sur /installer, la page possède sa propre UX : on masque le flottant.
 */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const pwa = usePwa();
  const pathname = usePathname();

  const [inviteClosed, setInviteClosed] = useState(false);
  const [updateClosed, setUpdateClosed] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onInstall = useCallback(async () => {
    if (pwa.autoInvite.kind === "ios-instructions") {
      setIosOpen(true);
      return;
    }
    setBusy(true);
    try {
      await pwa.promptInstall();
    } finally {
      setBusy(false);
    }
  }, [pwa]);

  const onDismiss = useCallback(() => {
    pwa.dismissInvite();
    setInviteClosed(true);
  }, [pwa]);

  // Doctrine liste blanche (fail-closed) : une proposition NON SOLLICITÉE n'apparaît que sur
  // les surfaces produit. Le funnel commercial (« / », « /demo », « /checkout »…) en est exclu :
  // le visiteur y juge le produit, une carte flottante y recouvrirait un CTA. `/installer` est
  // exclu aussi (la page porte sa propre UX). Une demande MANUELLE reste possible partout.
  const autoAllowedHere = isPwaAutoInvitePath(pathname);
  const showInvite =
    pwa.mounted && autoAllowedHere && !inviteClosed && pwa.autoInvite.show && !iosOpen;
  const showUpdate = pwa.mounted && !updateClosed && pwa.updateAvailable;

  // Le mini-onboarding est « vu » dès qu'il a réellement été présenté une fois ⇒ ignoré ensuite
  // (il reste réouvrable volontairement depuis /installer).
  useEffect(() => {
    if (showInvite && !pwa.isInstalled) pwa.markOnboardingSeen();
  }, [showInvite, pwa]);

  return (
    <PwaContext.Provider value={pwa}>
      {children}

      {showUpdate && (
        <UpdateToast
          onUpdate={pwa.applyUpdate}
          onDismiss={() => setUpdateClosed(true)}
        />
      )}

      {showInvite && (
        <InstallPrompt onInstall={onInstall} onDismiss={onDismiss} busy={busy} />
      )}

      <IosInstallSheet
        open={iosOpen}
        onClose={() => setIosOpen(false)}
        isSafari={pwa.info.isIosSafari}
      />
    </PwaContext.Provider>
  );
}
