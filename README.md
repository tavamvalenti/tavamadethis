# tavamadethis.com

Tava Valenti's portfolio. This repository **is** the website: the live site at https://tavamadethis.com serves the repository root as-is (static HTML, no build step).

## Layout

| Path | What it is | Live URL |
| --- | --- | --- |
| `index.html`, `img/`, `fonts/`, `vid/` | The portfolio home page and its shared assets | `/` |
| `tiny-world/` | Tiny World, the browser game (its own `index.html`, `game.html`, `js/`, `assets/`) | `/tiny-world/` |
| `onewheel/` | Temporary client demo for SD Onewheel Rentals (removed once the client's own domain is live) | `/onewheel/` |
| `game.html` | Old Tiny World address; forwards to `/tiny-world/game.html` | `/game.html` |
| `CNAME` | Custom domain for GitHub Pages | |
| `wrangler.jsonc`, `_headers`, `.assetsignore` | Cloudflare Workers Builds config, cache rules, files left out of the deploy | |
| `_dev/` | Not part of the site. Project notes, database scripts and dev tools, grouped by project (`_dev/tiny-world/...`). Folders starting with `_` are not published by GitHub Pages and are ignored by the Cloudflare deploy. | not served |

## Old links that must keep working

- `tavamadethis.com/?ref=CODE` and installed home-screen copies of Tiny World are forwarded to `/tiny-world/` by the script at the top of `index.html`.
- `/tiny-world/` and `/onewheel/` keep their paths. Do not rename those folders without adding forwards.

## Working on it

Serve the repo root with any static server (`python3 -m http.server`) and open `/`. Merging to `main` deploys.
