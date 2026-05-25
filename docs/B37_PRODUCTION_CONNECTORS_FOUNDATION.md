# B37 — Production Connectors Foundation I

**Status:** Complete — not yet live (safety gates active)  
**Verdict impact:** gap_real_email criticality high → medium, gap_real_file_extraction criticality high → medium

---

## What B37 adds

B37 closes the two biggest infrastructure gaps that kept Pierre at `almost_sellable`:

1. **Real email delivery via Resend** — full adapter with multi-layer safety gates
2. **Real document extraction** — PDF (pdf-parse), DOCX (mammoth), XLSX (SheetJS) for text-based files

Neither feature sends real emails or touches a real API in tests, CI, or dev by default.

---

## Part A — Resend Email Provider

### Files

- `src/lib/cloneos/channels/providers/resend.ts` — Resend adapter
- `src/lib/cloneos/channels/providers/router.ts` — provider selection (mock fallback)
- `src/lib/cloneos/channels/runtime.ts` — updated to use router

### Activation

```env
CHANNEL_RUNTIME_MODE=production
CHANNEL_DEFAULT_PROVIDER=resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_SEND_LIVE=true        # Must be explicitly true
EMAIL_DRY_RUN=false         # Must be explicitly false
```

All four conditions must be met for a real send. If any is missing, the provider falls back to dry-run.

### Safety architecture

| Gate | Env var | Default | Effect when false |
|------|---------|---------|-------------------|
| API key | `RESEND_API_KEY` | absent | Falls back to mock |
| Provider selection | `CHANNEL_DEFAULT_PROVIDER=resend` | `mock` | Uses mock provider |
| Dry-run | `EMAIL_DRY_RUN=false` | `true` | Returns `dry_run_*` ID, no HTTP call |
| Live gate | `EMAIL_SEND_LIVE=true` | `false` | Forced dry-run even if `EMAIL_DRY_RUN=false` |

### Domain guard

Set `RESEND_ALLOWED_FROM_DOMAINS=example.com,autre.fr` to restrict which from-addresses are permitted. Empty = allow all.

### Sandbox redirect

Set `RESEND_SANDBOX_TO=sandbox@yourteam.com` to redirect ALL outbound emails to a single test address. Strips CC/BCC in sandbox mode.

### Dry-run response shape

```json
{
  "ok": true,
  "provider_message_id": "dry_run_1748158423_abc123",
  "error": null,
  "meta": {
    "dry_run": true,
    "payload_preview": {
      "to": ["recipient@client.com"],
      "from": "pierre@example.com",
      "subject": "Test RH",
      "has_html": true,
      "has_text": true
    }
  }
}
```

### Testing

```bash
npm run test:channels-b37     # 14 tests
```

Tests cover: mock default, resend selected when configured, config validation, dry-run, EMAIL_SEND_LIVE=false, domain guard (block/allow), sandbox_to, reply_to, mapResendError key redaction, provider_message_id, supports().

---

## Part B — Real File Extraction

### Files

- `src/lib/cloneos/files/extractors/pdf.ts` — pdf-parse wrapper
- `src/lib/cloneos/files/extractors/docx.ts` — mammoth wrapper
- `src/lib/cloneos/files/extractors/xlsx.ts` — SheetJS wrapper
- `src/lib/cloneos/files/extraction.ts` — `extractFileTextAsync()` added
- `src/lib/cloneos/files/runtime.ts` — updated to use async extraction

### Extraction matrix

| Kind | Engine | Notes |
|------|--------|-------|
| `text` | built-in | Always real, sync |
| `csv` | built-in | Always real, sync |
| `pdf` | pdf-parse | Text-layer PDFs only; scanned → "OCR requis" warning |
| `docx` / `doc` | mammoth | `extractRawText({ buffer })` |
| `xlsx` | SheetJS | Up to 5 sheets × 200 rows per sheet |
| `image` | mock | OCR not available |
| `unknown` | mock | Pass-through |

### Graceful degradation

All three extractors use dynamic imports. If the package is not installed:

- Returns `{ ok: false, error: "<package> non disponible." }`
- Warning: `"<package> non installé — extraction indisponible."`
- Never throws

### Privacy gate

`FILE_LOG_EXTRACTED_TEXT=false` (default) sets `text: null` in all extraction results. `preview` is always populated for UX.

### Testing

```bash
npm run test:files-b37     # 16 tests
```

Tests cover: plain text real extraction, CSV real extraction, empty buffer guards (PDF/DOCX/XLSX), graceful PDF error on invalid bytes, XLSX real in-memory workbook extraction (conditional on package), async routing, FILE_LOG_EXTRACTED_TEXT=false behavior.

---

## Part C — B36 Audit Update

### Gap register changes

| Gap | Before B37 | After B37 |
|-----|-----------|-----------|
| `gap_real_email` | criticality: high | criticality: medium — Resend adapter ready, key config is now ops not engineering |
| `gap_real_file_extraction` | criticality: high | criticality: medium — real text-based extraction added; OCR still missing |

### Feature matrix changes

| Evidence | Before B37 | After B37 |
|----------|-----------|-----------|
| `fc_b34_files` | score 4/5 | score 5/5 — real extractors added |
| `fc_b33_channels` | mock_only | partial — Resend adapter added with dry-run |
| `rp_email` | mock_only | partial — adapter ready, live key pending |

**Score impact:** +1 point from `fc_b34_files` upgrade. Verdict remains `almost_sellable` (~80/100) — no real live send yet.

---

## Part D — Production Smoke Tests

```bash
npm run test:b37     # all 39 B37 tests
```

Smoke tests verify:
1. `EMAIL_SEND_LIVE=false` always blocks real send (double gate)
2. Channel runtime defaults to mock with no config
3. `disabled` mode returns `null` provider
4. File extraction never throws on garbage/empty input
5. Audit verdict is at least `almost_sellable` after B37
6. `blocker_count` = 0
7. `gap_real_email` still present (honest) with non-blocker criticality

---

## Activation checklist (production)

Before setting `EMAIL_SEND_LIVE=true`:

- [ ] `RESEND_API_KEY` set in production secrets (not in .env.local committed to git)
- [ ] SPF record published for sending domain
- [ ] DKIM configured in Resend dashboard for sending domain
- [ ] Test with `RESEND_SANDBOX_TO=yourteam@company.com` first
- [ ] Confirm Resend account is not on free tier if volume > 100/day
- [ ] `RESEND_ALLOWED_FROM_DOMAINS` locked to verified domains
- [ ] `CHANNEL_RUNTIME_MODE=production` set in production only

---

## Package dependencies added

```json
{
  "dependencies": {
    "mammoth": "^1.8.0",
    "pdf-parse": "^1.1.1",
    "resend": "^4.1.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4"
  }
}
```

All use dynamic imports — not bundled into client JS, no SSR issues.
