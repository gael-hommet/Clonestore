// src/lib/clonechat/attachments/__tests__/manifest-c1-7.test.ts
// C1.7 §10/§14.E — PIÈCES JOINTES : images, documents, DOSSIERS.
//
// Les trois vérités que ce module rend structurelles :
//   SÉLECTIONNER ≠ TÉLÉVERSER ≠ ANALYSER.
// Et la règle de sécurité : rien n'est jamais exécuté, aucune archive n'est ouverte, aucun chemin
// absolu du disque de l'utilisateur ne fuit.

import { describe, it, expect } from "vitest";
import {
  buildManifest, classifyFile, manifestSummary, safeRelativePath, safeDisplayName,
  imageDetailFor, categoryOf, MAX_FILES, MAX_FILE_BYTES, MAX_BATCH_BYTES,
} from "../manifest";

const f = (name: string, mime: string, size = 1000, relativePath?: string) => ({ name, mime, size, relativePath });

describe("C1.7 — un fichier SÉLECTIONNÉ n'est ni téléversé ni analysé", () => {
  it("l'état initial est « selected » — jamais « analysed »", () => {
    const m = buildManifest([f("note.pdf", "application/pdf")]);
    expect(m[0].state).toBe("selected");
    expect(m.every((e) => e.state !== "analysed")).toBe(true);
  });
});

describe("C1.7 — types réellement pris en charge", () => {
  const supported: Array<[string, string]> = [
    ["photo.png", "image"], ["scan.jpeg", "image"], ["visuel.webp", "image"],
    ["contrat.pdf", "pdf"],
    ["avenant.docx", "document"], ["presentation.pptx", "document"], ["texte.odt", "document"],
    ["paie.xlsx", "spreadsheet"], ["export.csv", "spreadsheet"],
    ["notes.md", "text"], ["data.json", "text"], ["script.ts", "text"],
  ];
  for (const [name, cat] of supported) {
    it(`${name} → ${cat}`, () => expect(categoryOf(name)).toBe(cat));
  }
});

describe("C1.7 — sécurité : rien n'est exécuté, rien n'est décompressé", () => {
  it("les exécutables sont refusés (y compris déguisés)", () => {
    for (const name of ["virus.exe", "script.bat", "payload.ps1", "app.msi", "facture.pdf.exe"]) {
      const r = classifyFile(f(name, "application/octet-stream"));
      expect(r.rejection?.code).toBe("EXECUTABLE_BLOCKED");
    }
  });

  it("les archives sont refusées (jamais ouvertes)", () => {
    for (const name of ["dossier.zip", "backup.tar", "data.7z", "image.iso"]) {
      expect(classifyFile(f(name, "application/zip")).rejection?.code).toBe("ARCHIVE_BLOCKED");
    }
  });

  it("un MIME exécutable est refusé même avec une extension anodine", () => {
    expect(classifyFile(f("innocent.txt", "application/x-msdownload")).rejection?.code).toBe("EXECUTABLE_BLOCKED");
  });

  it("une extension d'image portant un MIME non-image est refusée", () => {
    expect(classifyFile(f("faux.png", "application/pdf")).rejection?.code).toBe("EXTENSION_MISMATCH");
  });

  it("un type inconnu est refusé — jamais une promesse creuse d'analyse", () => {
    expect(classifyFile(f("truc.xyz", "application/unknown")).rejection?.code).toBe("TYPE_UNSUPPORTED");
  });
});

describe("C1.7 — bornes : taille, nombre, lot", () => {
  it("un fichier trop lourd est refusé", () => {
    expect(classifyFile(f("gros.pdf", "application/pdf", MAX_FILE_BYTES + 1)).rejection?.code).toBe("FILE_TOO_LARGE");
  });

  it("un fichier vide est refusé", () => {
    expect(classifyFile(f("vide.pdf", "application/pdf", 0)).rejection?.code).toBe("EMPTY_FILE");
  });

  it("au-delà du nombre maximum, les fichiers sont refusés — mais VISIBLEMENT", () => {
    const many = Array.from({ length: MAX_FILES + 3 }, (_, i) => f(`p${i}.pdf`, "application/pdf"));
    const m = buildManifest(many);
    const s = manifestSummary(m);
    expect(s.accepted).toBe(MAX_FILES);
    expect(s.rejected).toBe(3);
    // Les refusés RESTENT dans le manifeste avec leur motif : l'utilisateur doit les voir.
    expect(m.filter((e) => e.rejection?.code === "TOO_MANY_FILES").length).toBe(3);
  });

  it("le lot total est borné (chaque fichier respecte pourtant la limite individuelle)", () => {
    const each = 18 * 1024 * 1024;            // 18 Mo : SOUS la limite par fichier (20 Mo)
    expect(each).toBeLessThanOrEqual(MAX_FILE_BYTES);
    const m = buildManifest(Array.from({ length: 4 }, (_, i) => f(`p${i}.pdf`, "application/pdf", each)));
    // 3 × 18 Mo = 54 Mo ≤ 60 Mo ; le 4e ferait 72 Mo → refusé pour le LOT, pas pour sa taille.
    expect(m.slice(0, 3).every((e) => e.state === "selected")).toBe(true);
    expect(m[3].rejection?.code).toBe("BATCH_TOO_LARGE");
    expect(manifestSummary(m).totalBytes).toBeLessThanOrEqual(MAX_BATCH_BYTES);
  });
});

describe("C1.7 §10E — DOSSIERS : chemins relatifs, profondeur, fichiers masqués", () => {
  it("les chemins relatifs sont PRÉSERVÉS", () => {
    const m = buildManifest([f("contrat.pdf", "application/pdf", 100, "RH/2026/contrats/contrat.pdf")]);
    expect(m[0].relativePath).toBe("RH/2026/contrats/contrat.pdf");
    expect(m[0].displayName).toBe("contrat.pdf");
  });

  it("AUCUN chemin absolu du disque ne fuit jamais", () => {
    expect(safeRelativePath("C:\\Users\\homme\\Secret\\paie.xlsx", "paie.xlsx")).toBe("Users/homme/Secret/paie.xlsx");
    expect(safeRelativePath("/home/user/paie.xlsx", "paie.xlsx")).toBe("home/user/paie.xlsx");
    expect(safeDisplayName("C:\\Users\\homme\\paie.xlsx")).toBe("paie.xlsx");
    // Aucune remontée de dossier ne survit.
    expect(safeRelativePath("../../etc/passwd", "passwd")).toBe("etc/passwd");
  });

  it("les fichiers masqués et système sont écartés par défaut", () => {
    for (const p of [".DS_Store", "RH/.git/config", "__MACOSX/x.pdf", "Thumbs.db"]) {
      const r = classifyFile(f(p.split("/").pop()!, "application/pdf", 100, p));
      expect(r.rejection?.code).toBe("HIDDEN_FILE");
    }
  });

  it("un dossier trop profond est refusé", () => {
    const deep = "a/b/c/d/e/f/g/h/contrat.pdf";
    expect(classifyFile(f("contrat.pdf", "application/pdf", 100, deep)).rejection?.code).toBe("FOLDER_TOO_DEEP");
  });

  it("un dossier mixte : les supportés passent, les autres sont visiblement écartés", () => {
    const m = buildManifest([
      f("contrat.pdf", "application/pdf", 1000, "RH/contrat.pdf"),
      f("paie.xlsx", "application/vnd.ms-excel", 2000, "RH/paie.xlsx"),
      f("virus.exe", "application/octet-stream", 500, "RH/virus.exe"),
      f(".DS_Store", "application/octet-stream", 10, "RH/.DS_Store"),
    ]);
    const s = manifestSummary(m);
    expect(s.accepted).toBe(2);
    expect(s.rejected).toBe(2);
    expect(s.categories).toEqual({ pdf: 1, spreadsheet: 1 });
    expect(m.find((e) => e.displayName === "virus.exe")?.rejection?.code).toBe("EXECUTABLE_BLOCKED");
  });
});

describe("C1.7 §10B — détail visuel ÉCONOMIQUE par défaut", () => {
  it("une image ordinaire ne consomme pas le détail fin", () => {
    expect(imageDetailFor("Que montre cette photo ?")).toBe("low");
    expect(imageDetailFor("Qu'est-ce que c'est ?")).toBe("low");
  });

  it("le détail fin n'est utilisé que s'il est justifié", () => {
    expect(imageDetailFor("Lis le petit texte en bas de la capture.")).toBe("high");
    expect(imageDetailFor("Peux-tu interpréter ce graphique ?")).toBe("high");
    expect(imageDetailFor("Quel est le montant sur ce tableau ?")).toBe("high");
  });
});
