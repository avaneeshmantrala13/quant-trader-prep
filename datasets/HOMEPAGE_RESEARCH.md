# Homepage research: quant / coding interview-prep & educational sites

Research to inform a calmer, more trustworthy, education-first redesign of the
landing page. Goal: read as an *educational* product that helps students pass
quant **trader** online assessments (OAs) and interviews, not as a "scammy"
hype funnel.

## Sources reviewed

- **QuantGuide** — quant interview-prep platform. https://www.quantguide.io/ , https://www.quantguide.io/questions , https://www.quantguide.io/pricing
- **Trading Interview** — trader/quant interview-prep platform. https://www.tradinginterview.com/ , https://www.tradinginterview.com/the-trading-interview-platform/ , https://www.tradinginterview.com/packages/
- **Brilliant** — interactive STEM education. https://brilliant.org/ , brand/design writeups: https://pcho.medium.com/a-brilliant-brand-refresh-4af021c11486 , https://www.webdesignhot.com/design.md/brilliant-org/
- **LeetCode** — technical interview practice. https://leetcode.com/
- **Exercism** — learn-by-doing coding practice. https://exercism.org/
- **Zetamac / trader-math tools** — stripped-back timed mental-math drills (single-purpose, near-zero chrome). https://arithmetic.zetamac.com/

## Patterns worth adopting

1. **One clear value proposition above the fold.** The best pages state a single
   promise in plain language and stop. Brilliant: "Learn by doing" + one
   sentence. QuantGuide: "enhance your technical skills ... prepare for quant
   interviews." Exercism: "Get fluent ... learn by doing." No stacked claims, no
   competing headlines.
2. **A single primary CTA.** One dominant action ("Start", "Get started"), with
   at most one quiet secondary ("I have an account" / "Log in"). Avoid three
   equally-weighted buttons fighting for attention.
3. **Concrete "what you'll practice" / "how it works".** QuantGuide and Trading
   Interview both enumerate real, checkable topics (probability, mental math,
   brainteasers, market-making, company OAs). Brilliant frames method in 3-4
   short steps (concepts click -> built to make you think -> adapts to you).
   Specific and verifiable beats vague superlatives.
4. **Calm typographic hierarchy.** Brilliant is a "textbook that respects your
   intelligence": generous headings, near-monochrome canvas, ONE restrained
   accent (coral) used sparingly. Exercism/Zetamac lean almost entirely on type
   + whitespace. Hierarchy comes from size/weight/spacing, not color and boxes.
5. **Restrained, honest visuals.** Where visuals appear (Brilliant's geometry,
   QuantGuide's mental-math simulator preview), they *depict the actual product*.
   No stock imagery, no decorative "dashboards" that don't exist.
6. **Social proof, tastefully or omitted.** QuantGuide/Brilliant reference "users
   landed jobs at top firms" as a quiet line, not flashing logos or fake
   counters. Exercism omits proof entirely and reads as trustworthy because it
   is specific and calm. When you don't have real, defensible numbers, omit them
   rather than inventing stats.
7. **Method / mentorship as trust signal.** Trading Interview: "our team sat on
   both sides of the table." Brilliant: "built by learning experts." Framing
   *how* the content is made (fresh, verifier-checked, grounded in a real firm
   sweep) reassures more than adjectives.
8. **Single-purpose tools stay ruthlessly simple.** Zetamac is one input and a
   timer. The lesson: the mental-math / speed surfaces should read as focused
   and uncluttered, not buried in marketing.

## Anti-patterns to avoid (the "scammy"/overwhelming signals)

- **Vanity stat strips** ("4 · 17 · ∞", big counters) with no verifiable meaning.
  Reads as hype. Cut or replace with an honest, plain-language line.
- **Walls of near-identical feature cards / a dozen numbered "No. 01..05"
  sections.** Overwhelming; nobody reads five parallel pitches. Consolidate to a
  few genuinely distinct ideas.
- **Aggressive gradients, glows, blinking "▲ Live" badges, fake tickers, "You
  Win ▸" panels.** These read as a trading-hype product, not an educational one.
- **Multiple competing CTAs** of equal weight in the hero.
- **Overclaiming / inventing features.** Every claim on the page must map to a
  real, playable surface (diagnostic, tracks, OA sections, mock, roadmap,
  dashboard). Marketing visuals must depict real features (enforced by
  `visuals.test.tsx`).
- **Em-dash-heavy, breathless copy.** Prefer short sentences, periods, colons.

## What this means for our landing page

- Hero: one promise (pass quant-trader OAs & interviews via adaptive practice),
  one primary CTA (auth-aware), one calm supporting sentence, one honest,
  product-accurate visual. No stat strip, no fake live ticker.
- A single "How it works" flow (diagnostic -> adaptive practice -> timed OA
  sections & mock interviews -> mastery tracking + roadmap) in plain steps.
- A compact "What you'll practice" grid that lists only real tracks
  (probability/EV, mental math, brainteasers, market-making interview games).
- A short "why you can trust the practice" note (fresh, verifier-checked,
  grounded in a real firm requirements sweep) instead of vanity stats.
- Near-monochrome, minimalist-first, token-driven styling so every theme stays
  intact; one accent used sparingly; hierarchy from type and whitespace.
