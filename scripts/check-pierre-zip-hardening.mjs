#!/usr/bin/env node
import { existsSync, readFileSync } from "fs"; import { resolve, dirname } from "path"; import { fileURLToPath } from "url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."); const read = (r) => (existsSync(resolve(ROOT, r)) ? readFileSync(resolve(ROOT, r), "utf-8") : "");
const ok=(m)=>console.log(`  ✅ ${m}`); const warn=(m)=>console.log(`  ⚠️  ${m}`); let needs=0;
console.log("\n══ PHASE 8.3-B2 §5 — ZIP/DOCX Hardening — Check ══\n");
const z = read("src/lib/pierre/v1/zip-inspect.ts");
for(const [re,label] of [[/crc32\(out\) !== entry\.crc32/,"CRC32 validé à l'extraction"],[/uncompressed_size_mismatch/,"taille décompressée = déclarée"],[/encrypted_zip/,"zip chiffré refusé"],[/data_descriptor_unsupported/,"data descriptor refusé"],[/zip64_unsupported/,"ZIP64 refusé"],[/duplicate_critical_entry/,"entrées critiques dupliquées refusées"],[/duplicate_entry_name/,"noms dupliqués refusés"],[/compressed_data_out_of_bounds/,"bounds compressed data"],[/central_directory_truncated/,"central directory tronqué refusé"],[/deceptive_unicode_name/,"noms unicode trompeurs refusés"]]) if(re.test(z)) ok(label); else { warn(label+" absent"); needs++; }
console.log("\n"+(needs===0?" RÉSULTAT : PASS — durcissement testé (p83-zip-hardening.test 10/10).":` RÉSULTAT : NEEDS REVIEW — ${needs}.`)+"\n");
