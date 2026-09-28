# McD Macro

A personal, single-user nutrition planner. You log what you've already eaten
today, and it recommends McDonald's UAE combinations (plus Nada Protein Milk)
to fill the rest of your calorie/protein/fat targets — nothing more.

Not a general calorie tracker, not affiliated with McDonald's.

## Nutrition data status — READ BEFORE USING

The McDonald's UAE items in `lib/data/defaultSettings.ts` ship with
**zeroed, unverified macros and are disabled by default**. This build
environment could not reach `mcdonalds.com/ae` (network policy blocked it),
and the project's own rule is: never invent or substitute nutrition numbers.

Before the recommendation engine is useful, fill in official values:

1. Open the app → **Settings → Nutrition Database**.
2. For each item, enter the kcal/protein/fat/carbs from the official
   McDonald's UAE nutrition page, then check **Verified**.
3. Only `enabled && verified` items are ever used by the optimizer.

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
