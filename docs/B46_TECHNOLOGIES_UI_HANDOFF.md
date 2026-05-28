# B46 — Technologies UI Handoff

## Page location

`/profile/technologies` — rendered by `src/app/profile/technologies/page.tsx`

The page is at `/profile/` because `/mon-compte/` does not exist in the current app routing. When `/mon-compte/` is added in a future bloc, the page should be moved or aliased there.

## Design system

- Background: `#FAF8F5` (crème/ivoire)
- Cards: `bg-white/80 backdrop-blur-sm` with `border border-stone-200`
- Accent tops: `borderTopColor: item.display.accent` at 3px
- Status chips: color-coded (emerald=active, blue=ready, amber=degraded, red=blocked, stone=others)
- Score bar: gradient from red (< 50) → amber (50–69) → emerald (≥ 70)
- Icons: from `lucide-react` mapped via `ICONS` record

## Component structure

```
TechnologiesPage (default export)
├── Header bar (sticky, blur, score summary)
├── Status banner (green/amber)
├── "Technologies essentielles" section
│   └── TechnologyCard × 4 (launch_critical=true)
├── "Technologies optionnelles" section
│   └── TechnologyCard × 2 (launch_critical=false)
└── Footer note
```

### TechnologyCard props

```typescript
function TechnologyCard({ item }: { item: B46TechnologyItem })
```

Expandable on click (ChevronRight rotates). Expanded state shows:
- `item.display.customer_description`
- blockers (red AlertTriangle)
- warnings (amber AlertTriangle, max 2)
- "Configuration nominale" if no blockers/warnings
- Locked badge + explanation if `item.locked`

## Icon keys

| icon_key | Component |
|---------|-----------|
| `cpu` | `Cpu` |
| `dna` | `Dna` |
| `shield` | `Shield` |
| `activity` | `Activity` |
| `mic` | `Mic` |
| `message-circle` | `MessageCircle` |

## Status badge colors

| Status | Classes |
|--------|---------|
| `active` | `text-emerald-700 bg-emerald-50 border-emerald-200` |
| `ready` | `text-blue-700 bg-blue-50 border-blue-200` |
| `degraded` | `text-amber-700 bg-amber-50 border-amber-200` |
| `disabled` | `text-stone-500 bg-stone-100 border-stone-200` |
| `blocked` | `text-red-700 bg-red-50 border-red-200` |
| others | `text-stone-600 bg-stone-50 border-stone-200` |

## Data flow

The page is a pure client component that calls `buildAllB46TechnologyItems(context)` directly on the client. No API call at render time — the page builds technology items from `getDefaultB46ReadinessContext()` which uses environment variables already baked into the JS bundle at build time.

For real-time, persisted state: wire the `/api/clonestore/technologies/snapshot` endpoint and replace the direct call with a `useEffect`/SWR fetch.

## Locked badge

Technologies with `item.locked === true` show a `Lock` icon badge labeled "Essentiel" and — when expanded — a gray info box explaining they cannot be disabled.

## Future: edit interactions

The current page is read-only (display only). To add editing:
1. Add toggle switches for `enabled` field
2. Call `POST /api/clonestore/technologies/save` with the patch
3. Gate the UI interaction on `canEditTechnologyConfig(accessLevel, id)`
4. Never render edit controls for locked technologies
