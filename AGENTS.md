<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Battle game (`public/rpg/`)

`public/rpg/game.js` and `public/rpg/index.html` are the source of truth for the battle game; edit them directly. There is no separate build step anymore (the old local `build-web.mjs` / `battles.html` setup is retired), so nothing regenerates or overwrites these files. Sprites live in `public/rpg/a/`.

When you change `game.js`, bump the `?v=` tag on its `<script>` in `index.html` so browsers fetch the new file instead of a cached copy.

After changing the battle game, run `npm run test:rpg` (about 7 minutes; `RPG_QUICK=1` for the 1-minute checks). It plays the game in Chromium (`tests/rpg/`): every species' sprites and cries, the battle rules, all three Watch demos, and played battles and saves. The quick checks (`game.test.mjs`) and the long played tests (`play-a`, `play-b`, `play-c`) run side by side, one Chromium each; the music tests (`music.test.mjs`) run on their own afterwards, since they measure timing. Put a new long played test in whichever `play-*` file is shortest. Set `CHROMIUM_PATH` if Playwright's own Chromium isn't installed (`npx playwright install chromium`).

To check difficulty after changing levels, teams or moves, run `npm run sim:rpg` (about 30 seconds; `npm run test:rpg` also checks every fight is within 15 points of its aim). It simulates thousands of battles against every leader, Elite Four member, Red, Alex, and Herb and Paul's glitcher battles, at three player skill levels, and reports win rates against the aim: about 3 wins in 4, 1 in 2 for Lance (the Champion) and Red, 9 in 10 for Alex's friendly first battle and 1 in 3 for his last, 9 in 10 for Herb's and Paul's first and 2 in 3 for their last (`tests/rpg/sim.mjs`, `AIMS`).
