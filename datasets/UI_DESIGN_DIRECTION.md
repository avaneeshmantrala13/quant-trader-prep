# UI Design Direction — "The Daybook"

> Phase 1 of the UI overhaul. This document is the source of truth for the app's
> visual language. Phase 2 workers reskinning the seven stage screens MUST follow
> the tokens, type system, and rules below so the product stays coherent.
>
> Constraint reminder: this is a **styling/layout/tokens** overhaul only. No
> question content changes (`src/content/**`, `src/lib/mock/**`, `src/lib/oa/hardContent/**`,
> generators/solvers/blueprints). Presentational/marketing copy is fair game.

---

## 1. The chosen aesthetic — an editorial "trader's daybook"

The product is a serious, opinionated instrument for a serious task (getting hired
as a quant trader). It should read like a **well-made financial daybook / broadsheet
almanac** — the physical ledger a desk trader would actually keep — reinterpreted as
a calm, modern software surface.

The backbone is the **Swiss / International Typographic Style** (rigorous grid,
hierarchy carried by type size/weight/space rather than decoration, generous rhythm,
one small palette). On top of that backbone we take the **editorial** liberty of a
confident art director: an expressive **serif display** voice against a precise
**grotesque** for UI/body, warm **paper** rather than sterile white, tabular figures
on every number, and hairline rules instead of drop shadows.

Why this reads as **original / human-designed, not AI slop**:

- **Warm paper, not white or black.** The canvas is a warm oat/parchment in light
  and a warm ink-brown near-black in dark — never `#ffffff` or `#000000`. Warmth is a
  deliberate, un-generatable temperature decision (AI defaults regress to neutral
  white / blue-black).
- **Warm/cool tension.** Warm parchment paired with a single **cool deep-ink-blue**
  accent is a composed complementary decision, not a monochrome-plus-one-red default.
- **A real type pairing with a voice.** A characterful serif (Fraunces, with optical
  sizing) for display against a grotesque (Archivo) for UI, plus a mono (IBM Plex
  Mono) reserved for data/labels. This is the opposite of "Inter everywhere."
- **Editorial signatures a generator won't reach for:** small-caps mono kickers,
  numbered section rules, a lead-figure with a caption, tabular numerals, hairline
  double-rules, a nameplate wordmark. These are craft moves, not centroid moves.
- **One saturated accent, used as punctuation** (link, focus, active state, primary
  fill) — never rainbow, never a gradient.

It is distinct from the app's older "broadsheet" default (salmon newsprint + ochre)
and from the previous "minimalist" (sterile white/near-black + signal red + Inter):
this is a **cooler, quieter, more precise** parchment-and-ink instrument.

---

## 2. Palette (roles + hex, light & dark)

Colors are stored in the token layer as **space-separated RGB channels** (Tailwind
consumes them as `rgb(var(--token) / <alpha>)`). Hex shown here for humans.

### Light — "Daybook" (warm parchment)

| Role | Hex | RGB | Use |
|---|---|---|---|
| `bg` | `#F3F0E8` | 243 240 232 | Page — warm oat parchment |
| `surface` | `#FBF9F3` | 251 249 243 | Panels / cards |
| `surfaceRaised` | `#FFFFFF` | 255 255 255 | Elevated surface (rare) |
| `surfaceMuted` | `#E8E3D6` | 232 227 214 | Tracks, tonal fills, secondary buttons |
| `border` | `#D8D1C0` | 216 209 192 | Hairline rules |
| `borderStrong` | `#231F18` | 35 31 24 | Ink rules / heavy dividers |
| `textPrimary` | `#211E17` | 33 30 23 | Ink — headings & body (~14:1 on surface) |
| `textSecondary` | `#574F3F` | 87 79 63 | Secondary text (~7:1) |
| `textMuted` | `#6B6353` | 107 99 83 | Muted/annotation (~4.8:1, AA) |
| `accent` | `#1D4E6B` | 29 78 107 | **The one accent** — deep ink blue |
| `accentHover` | `#163C53` | 22 60 83 | Accent hover/pressed |
| `accentContrast` | `#FBF9F3` | 251 249 243 | Text/icon ON accent (paper white) |
| `accent2` | `#2A2419` | 42 36 25 | Secondary "accent" kept as ink (monochrome) |
| `gold` | `#9A6B1E` | 154 107 30 | Muted brass — rare mastery flourish |
| `success` / `bull` | `#2E7D57` | 46 125 87 | Correct / up (pine green) |
| `successSoft` | `#E1EAE0` | 225 234 224 | Soft success bg |
| `danger` / `bear` | `#B4472F` | 180 71 47 | Incorrect / down (warm brick, not alarm-red) |
| `dangerSoft` | `#F0E2D8` | 240 226 216 | Soft danger bg |
| `warning` | `#B07D28` | 176 125 40 | Warnings |
| `texGrid` | `#DFD8C8` | 223 216 200 | Ledger grid lines |
| `grainOpacity` | `0.04` | — | Whisper of paper grain |

### Dark — "Nocturne" (warm ink ledger, **not** pure black, **not** neon)

| Role | Hex | RGB | Use |
|---|---|---|---|
| `bg` | `#17150F` | 23 21 15 | Page — warm ink-brown near-black |
| `surface` | `#201D15` | 32 29 21 | Panels / cards |
| `surfaceRaised` | `#28241A` | 40 36 26 | Elevated surface |
| `surfaceMuted` | `#2F2A1F` | 47 42 31 | Tracks, tonal fills |
| `border` | `#3A3428` | 58 52 40 | Hairline rules |
| `borderStrong` | `#D8CFBC` | 216 207 188 | Light ink rules |
| `textPrimary` | `#ECE6D8` | 236 230 216 | Paper-white ink (~13:1 on surface) |
| `textSecondary` | `#BDB39C` | 189 179 156 | Secondary (~7:1) |
| `textMuted` | `#9E9581` | 158 149 129 | Muted (~4.8:1 on lightest surface, AA) |
| `accent` | `#83A9C7` | 131 169 199 | Soft chalk-blue (desaturated, not neon) |
| `accentHover` | `#9DBFD8` | 157 191 216 | Accent hover |
| `accentContrast` | `#17150F` | 23 21 15 | Ink ON accent |
| `accent2` | `#CFC7B4` | 207 199 180 | Secondary as light ink (monochrome) |
| `gold` | `#C9A24A` | 201 162 74 | Mastery flourish |
| `success` / `bull` | `#5FB588` | 95 181 136 | Correct / up |
| `successSoft` | `#182A20` | 24 42 32 | Soft success bg |
| `danger` / `bear` | `#D9714F` | 217 113 79 | Incorrect / down |
| `dangerSoft` | `#2E1C14` | 46 28 20 | Soft danger bg |
| `warning` | `#D0A24A` | 208 162 74 | Warnings |
| `texGrid` | `#2B2619` | 43 38 25 | Grid lines |
| `grainOpacity` | `0.05` | — | Paper grain |

**Palette rules (enforce in Phase 2):**
- The **ink blue is the ONLY saturated brand color.** Green/red are reserved as
  functional signals (bull/correct, bear/incorrect) — do NOT use them as decoration.
- Never introduce a second brand hue, a gradient, or a purple/violet/indigo wash.
- All text tokens are WCAG-AA against both `bg` and `surface` in both modes;
  `accentContrast` is AA against `accent` in both modes. Don't hand-pick off-token
  colors that break this.

---

## 3. Type system

Three families, already self-loaded via `src/index.css` (`@import` Google Fonts) —
**no Inter.**

| Role | Family | Where |
|---|---|---|
| Display | **Fraunces** (opsz 9–144, wght 400/500/600/900) | `h1–h3`, `.display`, nameplates, big numbers-as-headline |
| Body / UI | **Archivo** (wght 400–800) | Paragraphs, buttons, nav, most UI text |
| Mono / data | **IBM Plex Mono** (wght 400–600) | `.label` kickers, `.num` tabular figures, chips, timers, metadata |

- **Hierarchy comes from size + weight + space,** not color. Type scale ~1.25 ratio.
  Display sizes lean large and tightly tracked (`tracking-tight`); body is relaxed
  (`leading-relaxed`).
- **`.label`** = small-caps mono kicker (`0.14em` tracking) — the editorial signature.
  Use it above section titles, not as body.
- **`.num`** = IBM Plex Mono + `tabular-nums`. Use for EVERY number (scores, %,
  counts, timers, prices) so columns align like a ledger.
- Optical sizing on Fraunces is on (`font-optical-sizing: auto`).
- Reserve heavy Fraunces weights (800/900) for the largest display only.

---

## 4. Spacing, radius, border, shadow tokens

- **Spacing / rhythm:** 8pt-ish (Tailwind scale). Generous section padding
  (`py-14 sm:py-16`), aligned to a `max-w-5xl` centered column. Vary density by
  importance — do not repeat one uniform gap everywhere (uniform rhythm reads as AI).
- **Radius (disciplined, near-square):** `--radius-sm: 2px`, `--radius: 4px`,
  `--radius-md: 6px`. `rounded-full` stays a pill and is reserved for dots, progress
  tracks, and status pips only. Buttons are square-ish (radius `4px`), NOT pills —
  this is a considered instrument, not a friendly SaaS toy.
- **Borders:** hairline `1px` `border-subtle` for most separation; `border-strong`
  (ink) for structural dividers, nameplate rules, and the top rule on `.panel-ruled`.
  Double/heavier rules (`border-b-[3px]`) mark the primary header only.
- **Shadows:** essentially none. Depth comes from **hairline borders + tonal surface
  shifts + warm color temperature**, never from drop-shadow soup. If a floating layer
  (menu/popover) truly needs lift, use a single restrained shadow — never a glow.

---

## 5. Motion rules

- **Purposeful and short.** Color/opacity/transform only. `transition-colors` on
  interactive elements; `150–220ms` `ease-out` for entrances. No spring-bounce on
  primary UI (bouncy easings are reserved for the game-map node pops).
- **No fade-in-on-scroll everywhere** (an AI tell). Motion marks state change
  (hover/focus/active, a value updating, a card dealing), not decoration.
- **Respect `prefers-reduced-motion`** — the global rule in `index.css` already
  neutralizes animations; keep new motion inside that contract.
- The blinking terminal `.cursor` and the self-drawing price path are allowed
  editorial flourishes, kept subtle and reduced-motion-safe.

---

## 6. AI-slop signatures we deliberately avoid

Checklist Phase 2 must keep passing (any one is fine; the *cluster* is the tell):

- ❌ Violet/indigo→blue **gradients**; gradient text on dark. (We use ONE flat ink-blue.)
- ❌ **Glassmorphism** / frosted glass cards with glow shadows.
- ❌ **Inter** (or a single geometric sans) everywhere. (We pair serif + grotesque + mono.)
- ❌ **Neon-on-pure-black** dark mode. (Ours is warm ink-brown with a soft chalk-blue.)
- ❌ **Drop-shadow soup** and one uniform border radius on everything.
- ❌ **Emoji as icons.** (We use the in-house SVG icon set / hairline SVG figures.)
- ❌ Hero → **three identical feature cards** → centered CTA skeleton. (We use
  asymmetric editorial sections with alternating figure/text.)
- ❌ **Rainbow accents** / multiple saturated brand colors.
- ❌ **Low-contrast** "technically there" text (all tokens are AA-checked).
- ❌ Generic uplift copy ("build the future"). Copy names specific, real features.
- ❌ Red-on-black and other harsh combos. (Warm brick sits on warm paper, never neon
  red on pure black.)

---

## 7. Token / class layer (what Phase 2 builds on)

The whole app inherits the look through the token + shared-class layer — **do not
hardcode hex in components.** Consume these:

- **Colors:** `bg-bg`, `bg-surface`, `bg-surface-raised`, `bg-surface-muted`,
  `text-primary/secondary/muted`, `text-accent`, `bg-accent`/`accent-hover`,
  `text-accent-contrast`, `text-bull`/`bg-bull`, `text-bear`/`bg-bear`,
  `success(-soft)`, `danger(-soft)`, `gold`, `warning`, `accent-2`.
- **Rules:** `border-subtle` (hairline), `border-border-strong` (ink).
- **Fonts:** `font-display` (Fraunces), `font-sans` (Archivo), `font-mono` (Plex Mono).
- **Radii:** `rounded-sm | rounded | rounded-md`; `rounded-full` for pips/tracks only.
- **Shared component classes** (token-driven, already styled):
  `.panel`, `.panel-ruled`, `.card`, `.btn` / `.btn-primary` / `.btn-secondary` /
  `.btn-ghost`, `.input`, `.label`, `.chip`, `.num`, `.cursor`, `.tex-grid`, `.hatch`.

Files that own the token layer (changed in Phase 1):
- `src/themes/minimalist/index.ts` — the LIVE tokens injected at runtime (authoritative).
- `src/themes/base.ts` — fallback base tokens (kept in sync so un-overridden slots match).
- `src/index.css` — base element styles + the shared component classes above.
- `tailwind.config.js` — token→utility bindings, `tracking-label`, keyframes.

**Rule for Phase 2:** style stage screens ONLY through these classes/tokens. If you
need a new pattern, add it as a shared class here (so every screen inherits it),
don't sprinkle one-off hex or shadows in a single screen.
