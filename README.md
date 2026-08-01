# Study Manager — PWA

A fully installable, offline-capable Progressive Web App. This folder is ready to deploy as-is.

## Files

| File | Purpose |
|---|---|
| `index.html` | The app itself |
| `manifest.json` | Makes the app installable (name, icons, colors, standalone display) |
| `sw.js` | Service worker — caches everything needed so the app works fully offline |
| `icons/` | App icons (standard + maskable, all required sizes) |
| `favicon.ico` | Browser tab icon |
| `.nojekyll` | Tells GitHub Pages not to run Jekyll processing on these files |

## Deploy to GitHub Pages

1. Create a new GitHub repository (or use an existing one).
2. Push the **contents of this folder** to the repo root (or to a `/docs` folder — either works, just match it in step 3):
   ```bash
   git init
   git add .
   git commit -m "Study Manager PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`** → Save.
4. GitHub gives you a URL like `https://<your-username>.github.io/<your-repo>/`. Open it — that's your live app.

That's it. No build step, no dependencies to install — it's a static site.

## Installing it on your phone

Once the GitHub Pages URL is live:
- **Android (Chrome):** open the URL → menu (⋮) → **Install app** (or you'll get an automatic "Add to Home screen" prompt).
- **iPhone (Safari):** open the URL → Share button → **Add to Home Screen**.

It'll launch full-screen, with its own icon, no browser address bar — like a native app.

## How the offline support works

- The **first time** you open the app with internet access, the service worker (`sw.js`) downloads and caches: the app itself, its icons, Font Awesome (icons), the Inter font, and the PDF viewer library.
- After that first visit, **all of those load instantly from the cache** — including with airplane mode on or zero signal.
- Your actual study data (subjects, materials, notes) was already fully offline-first before this — it's stored locally on your device via IndexedDB, not on any server. This PWA setup only fixes the *app shell and its external resources* (fonts/icons/PDF library), which previously required a network connection to load.
- If you ever update `index.html` and redeploy, bump `CACHE_VERSION` at the top of `sw.js` (e.g. `'v1'` → `'v2'`) so returning visitors get the new version instead of a stale cached one.

## Notes

- Nothing about how the app looks, behaves, or stores your data was changed by this setup — this only adds the installability and offline-caching layer around the existing app.
- If you ever open the raw `index.html` file directly (e.g. via a file manager, not through the GitHub Pages URL), the service worker simply won't activate there (browsers don't allow service workers on `file://`/`content://`), and the app falls back to exactly how it worked before — including the Unicode icon fallback already built in for that scenario.
