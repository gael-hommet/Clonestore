# B45 — PDF-Ready Rendering

## Approach

B45 does **not** generate binary PDF files. Instead it produces **PDF-ready HTML** — a self-contained HTML document with print CSS (`@page`, `@media print`) that can be passed to Playwright `page.pdf()` or the browser's print dialog without any additional processing.

No new heavy dependencies (puppeteer, wkhtmltopdf, jsPDF) are added. The existing `mammoth` and `pdf-parse` packages handle file extraction only.

## Rendering Pipeline

```
DocumentRenderContext
    ↓
renderDocumentTemplateToHtml(ctx)  → HtmlRenderResult { html, text, warnings, missing_variables, unresolved_tokens }
    ↓
renderPdfReadyHtml(ctx)            → PdfReadyRenderResult { pdf_ready_html, text, estimated_page_count }
    ↓
buildPdfExportContract(ctx, pdfResult, artifactMetadata) → PdfExportContract
```

## PDF-Ready HTML Format

`renderPdfReadyHtml` injects print CSS after the existing `</style>` tag:

```css
@page {
  size: A4;
  margin: {page_layout.margin_top}cm {page_layout.margin_right}cm 
          {page_layout.margin_bottom}cm {page_layout.margin_left}cm;
}
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .b45-no-print { display: none !important; }
  .b45-page-break { page-break-after: always; }
  a { text-decoration: none; color: inherit; }
}
```

Page margins default to `2cm` on all sides (configurable via `DocumentStyleKit.page_layout`).

## PdfExportContract

```typescript
interface PdfExportContract {
  document_id: string;
  template_id: string;
  pdf_ready_html: string;
  estimated_page_count: number;
  page_size: "A4" | "letter";
  margin_cm: { top: number; right: number; bottom: number; left: number };
  artifact_metadata: DocumentArtifactMetadata;
  generated_at: string;
  validation_required: boolean;
}
```

`validation_required` mirrors `artifact_metadata.validation_required` — always `true` for `official_document` templates.

## Validation

`validatePdfReadyHtml(html)` checks:
- Contains `@page` rule
- Is a full HTML document (`<!DOCTYPE html>`)
- Does not contain script tags
- Returns `{ valid: boolean; issues: string[] }`

## Page Count Estimation

`estimatePdfPageCount(html)` estimates based on character count:
- ~3000 chars per A4 page
- Returns 0 for empty HTML, minimum 1 for any content

## Usage in Pierre

```typescript
// Render full document (includes pdf_ready_html)
const result = renderPierreDocument(ctx);
result.pdf_ready_html; // → ready for browser print / Playwright

// Or use the dedicated PDF pipeline
const contract = renderPierrePdfReadyDocument({
  templateId: "pierre_employment_certificate_simple_v1",
  variables: { ... },
  enterprise,
  pierre,
  userId,
});
// contract.pdf_ready_html → pass to print service
// contract.validation_required → true for official docs
```

## Security Notes

- `stripUnsafeHtml` runs on all generated HTML before PDF preparation.
- Script tags, iframe, form, input, button, and event handlers are removed.
- Token values are HTML-escaped via `resolveTemplateTokensHtml` before rendering.
- JS protocol links (`javascript:`) are stripped.
- No raw HTML from client inputs is ever injected.
