# McD Macro

A personal, single-user nutrition planner. You log what you've already eaten
today, and it recommends McDonald's UAE combinations (plus Nada Protein Milk)
to fill the rest of your calorie/protein/fat targets — nothing more.

Not a general calorie tracker, not affiliated with McDonald's.

## Nutrition data status

The McDonald's UAE items in `lib/data/defaultSettings.ts` are populated and
enabled, sourced from the official product pages linked in each entry
(researched 2026-09-28, since this build environment's network policy
blocks `mcdonalds.com/ae` directly). Spot-check a couple against the live
pages when convenient.

To edit or re-verify a value:

1. Open the app → **Settings → Nutrition Database**.
2. Update kcal/protein/fat/carbs, keep **Verified** checked.
3. Only `enabled && verified` items are ever used by the optimizer —
   uncheck either to exclude an item.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- No backend, no login — all state in `localStorage`
- Deterministic combination-search optimizer (no LLM calls) in `lib/engine/`
- Vitest unit tests for the nutrition math and optimizer

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # run the unit tests
npm run build    # production build
```

## Deploying

The project is a stock Next.js app, so it deploys to Vercel with zero config:

1. Go to https://vercel.com/new and import this GitHub repository.
2. Leave all settings default (Framework: Next.js) → **Deploy**.
3. Vercel gives you a live `*.vercel.app` URL.

Every push to `main` redeploys automatically.

## Updating later

Edit files locally or here, then:

```bash
git add -A
git commit -m "..."
git push
```

Vercel picks up the push and redeploys within ~1 minute.

## Backup copy

If Vercel is unreachable, the same app is published on GitHub Pages:
https://kdyn6pt9by-maker.github.io/mcd-macro-planner/
(Data lives on the phone per address — move it with Settings → Backup → Export / Import.)
