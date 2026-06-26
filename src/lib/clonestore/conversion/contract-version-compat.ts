// Backward compatibility shim — premier commit BLOC 3 exposait CONTRACT_VERSION_REF.
// Ce module est conservé pour ne pas casser un éventuel consommateur externe ;
// la source unique reste désormais `contract.ts:LEADFORGE_COMMIT`.

export const CONTRACT_VERSION_REF = "1.0.0" as const;
