---
name: capture-preview-gifs
description: Use when creating or refreshing an animated GIF in assets/previews/ for a project card on this homepage. Covers both CLI tools (VHS tape recordings) and web apps (live Playwright capture), plus the compression and QA steps that apply to either.
---

# Capturing preview GIFs

Every project card can have a `.preview` GIF (`assets/previews/<project>.gif`, referenced via `data-src` in `index.html`). There are two capture paths depending on the project type. Pick one, then run both projects' assets through the same compression and QA steps.

## Path A: CLI tools (VHS tape)

rolomux, boomerang, teleport already have `docs/demo/*.tape` scripts in their own repos that render to `docs/images/*.gif` (used in their READMEs). Don't re-record here — just copy the existing rendered GIF into this repo's `assets/previews/`.

If a CLI tool has no `.tape` script yet (e.g. backlog), that's real work in the *other* repo: write the VHS tape there, decide what to feed it as demo input/data, render it, then copy the output here. Don't fabricate a recording by any other method.

## Path B: web apps (live Playwright capture)

For a deployed site (rastermaster, discography, and any future web project), record the *actual live site* driven by real interactions, not a mock or a static screenshot:

1. Install once per session: `npx playwright install chromium` (or confirm `~/Library/Caches/ms-playwright` already has it).
2. Launch Chromium with `recordVideo: { dir, size }` on the browser context, sized to match the viewport you're capturing (e.g. 1280x1000).
3. `goto` the live URL, then **drive real interaction** — type into real inputs, click real buttons that change state. An idle screenshot loop is not a preview; motion is the entire reason to use a GIF over the existing static-screenshot approach. See per-tool notes below for what "real interaction" means for each site.
4. Close the context to flush the `.webm` file.

### No white flash

`recordVideo` starts capturing at context creation, before the page's first paint — the first few frames are blank white (or whatever the browser's default background is) until the dark-themed page renders. Left in, this shows as a jarring white flash at the start of every loop.

Find the actual cutover point before converting, don't guess:

```bash
for t in 0.1 0.2 0.3 0.4 0.5; do
  ffmpeg -y -i input.webm -ss $t -frames:v 1 -update 1 "/tmp/f_$t.png" 2>/dev/null
  convert "/tmp/f_$t.png" -colorspace Gray -format "%[fx:mean*255]" info:; echo " @ $t"
done
```

Mean brightness near 255 = still blank. Once it drops to roughly the page's real background level, that's your cutover. Pass that value as `-ss` **before** `-i` when encoding the GIF (rastermaster needed 0.2s, discography needed 0.4s — recheck per project, don't reuse a fixed constant).

## Compression (applies to both paths, but web captures need it more)

Web captures come out of `ffmpeg` at several MB by default, 10-50x larger than the VHS-sourced GIFs (which start from a small, limited terminal palette). Bring every web-captured GIF down to the same order of magnitude as its siblings in `assets/previews/` before committing:

```bash
ffmpeg -y -ss <cutover> -i input.webm \
  -vf "crop=W:H:0:0,fps=10,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" \
  out.gif
```

Levers, in order of impact when a first pass is too big:
- **Scale to the actual display width**, not the capture resolution. The `.preview` overlay in `style.css` renders at `width: 480px` — there's no reason to ship pixels the browser will immediately downscale.
- **Trim duration** to just the interesting motion (`-t 4.5` or similar). GIFs loop, so 4-6s is plenty; don't ship the full recording including setup time.
- **Drop fps** (10-12 is enough for UI motion; 8 is fine if nothing moves fast).
- **Drop palette size and dithering.** Content with animated grain/noise (see discography below) defeats temporal compression no matter what — for that, drop `max_colors` to ~64 and use `dither=none` rather than `bayer`, which otherwise adds its own pseudo-random noise on top.
- **Crop dead chrome.** Check the last row of a crop for partial cutoff before finalizing (a table row or panel edge sliced in half looks like a bug).

Check the result against existing files in `assets/previews/` (`ls -la`) — if you're an order of magnitude off, iterate rather than shipping it.

## QA before committing

1. Extract a first-frame and a mid-loop frame from the finished GIF and look at both — confirm no white flash on frame one, and that UI text is legible **at 480px**, since that's the actual rendered size (previews were previously redesigned specifically because a smaller inline version was unreadable — don't regress that).
2. Serve the site locally (`python3 -m http.server`) and hover the real card with Playwright to confirm the image loads with no console/request errors, at the real page layout.
3. After pushing, poll `gh api repos/jeffdt/homepage/pages/builds/latest --jq .status` until `built`, then `curl` the asset URL on `jeffdt.com` directly.
4. **Check `cf-cache-status` on that curl.** Cloudflare edge-caches these for 4 hours (`max-age=14400`). If you're replacing an existing GIF at the same filename, a stale edge copy can serve `HIT` after deploy — purge it explicitly via the Cloudflare MCP (`purge_cache` with the specific file URLs) rather than waiting it out or telling the user to hard-refresh.

## Per-tool notes

Append a subsection here whenever a new tool gets a preview — this list is expected to grow.

**rastermaster** — fill `#stockWidth` / `#stockHeight` with a realistic pair (e.g. 24x6, like actual stock dimensions) rather than an arbitrary square; blur the field and move the mouse away afterward or a tooltip (`Measure tallest dimension...`) sticks in the frame. Clicking `#generateBtn` scrolls the pass-schedule table into view, which is a nice bit of free motion. The X-axis/Y-axis direction toggle button visually activates but does **not** redraw the toolpath preview — skip it, it reads as broken.

**discography** — click the `Randomize` button rather than trying to navigate directories by double-click (unreliable/flaky in headless Chromium, not worth debugging further). Launch Chromium with `--autoplay-policy=no-user-gesture-required` or the AudioContext stays suspended and the visualizer never animates. The visualizer's CRT grain overlay animates every frame, which is unusually hostile to GIF compression — use the more aggressive compression settings from above (low colors, no dither).

**rolomux / boomerang / teleport** — Path A (VHS), already recorded in their own repos. Just copy `docs/images/*.gif` from the source repo into `assets/previews/`.

**backlog** — no capture path yet. Needs a new `.tape` script written in that repo first, plus a decision on real synced library data vs. fabricated placeholder titles before either path applies.
