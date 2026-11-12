# Meep web (Next.js)

A browser task manager for Meep accounts. It talks to the same Supabase project as the
Expo app, so tasks added or completed here show up in the app and vice versa.

This is separate from the Expo app's own web build (`npm run web` at the repo root),
which ships the full app to the browser.

## Run

```bash
cp .env.example .env.local   # same public Supabase URL + anon key as the app
npm install
npm run dev
```

## How it shares code with the app

- `next.config.ts` sets `turbopack.root` to the repo root, so the site imports
  `../types` and `../lib/taskRows.ts` directly. Shared files must use relative imports
  and no React Native modules (both projects map `@/` to their own root).
- The repo root's `metro.config.js` and `tsconfig.json` exclude `web/`, so the Expo
  build never sees this folder.

## Notes

- Auth is client-side (`@supabase/supabase-js`, session in localStorage); row-level
  security on `tasks` keeps each user to their own rows.
- Google sign-in redirects back to `window.location.origin`; add each site origin
  (e.g. `http://localhost:3000`, the deployed URL) to the Supabase project's allowed
  redirect URLs.
- Live updates use Supabase Realtime on `tasks` when it's enabled for that table;
  otherwise the list refreshes whenever the tab regains focus.
- Deploying to Vercel: set the project's Root Directory to `web`.
