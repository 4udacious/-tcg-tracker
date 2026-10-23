<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Battle game (`public/rpg/`)

`public/rpg/game.js` and `public/rpg/index.html` are the source of truth for the battle game; edit them directly. There is no separate build step anymore (the old local `build-web.mjs` / `battles.html` setup is retired), so nothing regenerates or overwrites these files. Sprites live in `public/rpg/a/`.

When you change `game.js`, bump the `?v=` tag on its `<script>` in `index.html` so browsers fetch the new file instead of a cached copy.

After changing the battle game, run `npm run test:rpg` (about 6 minutes; `RPG_QUICK=1` for the 1-minute checks). It plays the game in Chromium (`tests/rpg/`): every species' sprites and cries, the battle rules, all three Watch demos, and a played battle and save. Set `CHROMIUM_PATH` if Playwright's own Chromium isn't installed (`npx playwright install chromium`).
