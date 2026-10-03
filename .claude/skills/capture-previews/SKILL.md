---
name: capture-previews
description: Use when creating or refreshing a hover preview (animated GIF or looping MP4) for a project card on this homepage. Covers both CLI tools (VHS tape GIFs) and web apps (live Playwright capture encoded to MP4), plus the encoding and QA steps.
---

# Capturing previews

Every project card can have a `.preview` overlay, referenced via `data-src` in `index.html`. The format depends on the project type: CLI tools use a live-linked VHS **GIF** in an `<img>`; web apps use a local looping **MP4** (`assets/previews/<project>.mp4`) in a `<video muted loop playsinline preload="none">`. `preview.js` handles both, lazy-loading on first hover and playing/pausing videos on enter/leave.

Why the split: terminal recordings have a tiny flat palette and suit GIF well. Web UIs (gradients, smooth motion, animated grain) forced GIFs down to 8-10fps and 64-128 colors and still landed around 700KB, which looked choppy next to the CLI previews. H.264 at 25fps and 2x resolution comes in at roughly 75-125KB.

## Path A: CLI tools (VHS tape, live-linked)

rolomux, boomerang, teleport already have `docs/demo/*.tape` scripts in their own repos that render to `docs/images/*.gif` (used in their READMEs). This repo is touched rarely while those repos iterate often, so `index.html` points `data-src` directly at the source repo's rendered GIF via jsDelivr's GitHub CDN rather than keeping a local copy that would silently go stale:

```
https://cdn.jsdelivr.net/gh/jeffdt/<repo>@main/docs/images/<file>.gif
```

No separate "compressed preview" variant is needed in the source repos: VHS terminal recordings already compress to tens-to-low-hundreds of KB thanks to their limited native color palette (verified against rolomux/boomerang/teleport's existing demo GIFs, all well under the web-capture GIFs' size despite larger pixel dimensions than the 480px display width — the browser just downscales). If a future tape balloons past ~300KB, revisit before shipping it as a live-linked preview.

jsDelivr edge-caches for up to 12h (`s-maxage=43200`) and browsers for 7 days, so a fresh re-record in the source repo won't show up on the homepage instantly — that's fine given how rarely this repo needs the update to actually be visible, but don't expect it to reflect within minutes of a push.

If a CLI tool has no `.tape` script yet (e.g. backlog), that's real work in the *other* repo: write the VHS tape there (see `tui-utils`' shared `vhs-recording` skill), decide what to feed it as demo input/data, render it, then point `index.html` at it the same way. Don't fabricate a recording by any other method, and don't copy the GIF into this repo's `assets/previews/`.

## Path B: web apps (live Playwright capture, MP4)

For a deployed site (rastermaster, discography, and any future web project), record the *actual live site* driven by real interactions, not a mock or a static screenshot:

1. Install once per session: `npx playwright install chromium` (or confirm `~/Library/Caches/ms-playwright` already has it).
2. Launch Chromium with `recordVideo: { dir, size }` on the browser context, sized to match the viewport you're capturing (e.g. 1280x1000).
3. `goto` the live URL, then **drive real interaction** — type into real inputs, click real buttons that change state. An idle screenshot loop is not a preview; motion is the entire reason to use an animated preview over a static screenshot. See per-tool notes below for what "real interaction" means for each site.
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

Mean brightness near 255 = still blank. Once it drops to roughly the page's real background level, that's your cutover. Pass that value as `-ss` **before** `-i` when encoding. Also check that the first kept frame isn't mid-fade or half-rendered: rastermaster's form fades in, so it starts at 0.7s even though the white is gone by 0.2s. Recheck per project; don't reuse a fixed constant.

## Encoding web captures (MP4)

Record at a 1280x1000 viewport, then encode the raw `.webm` straight to MP4. Never re-encode an old preview; always start from a fresh capture.

```bash
ffmpeg -y -ss <cutover> -i input.webm -t 5 -an \
  -vf "scale=960:-2:flags=lanczos,fps=25" \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart \
  assets/previews/<project>.mp4
```

- **960px wide** = 2x the 480px max display width, so text stays crisp on retina screens. It's affordable now in a way it never was with GIF.
- **`-an`** strips audio; the element is `muted` anyway.
- **`-movflags +faststart`** lets playback begin before the whole file arrives.
- **`-pix_fmt yuv420p`** is required for Safari.
- **Trim** to the interesting motion (`-t 5` or so); it loops.
- Target roughly 75-150KB. If a clip lands well above that, raise CRF (32-34) before cutting resolution.
- MP4 alone is enough. VP9 WebM was tested and came out *larger* than H.264 at comparable quality, and H.264 plays everywhere.

Markup: set `width="960" height="750"` (the encoded dimensions) on the `<video>` so the overlay reserves the right aspect ratio before metadata loads, and use `aria-label` in place of `alt`.

## QA before committing

1. Extract a first-frame and a mid-loop frame from the finished file and look at both: confirm no white flash or half-rendered page on frame one, and that UI text is legible **at 480px**, since that's the max rendered size (previews were previously redesigned specifically because a smaller inline version was unreadable; don't regress that).
2. Serve the site locally (`python3 -m http.server`) and hover the real card with Playwright: confirm the media loads with no console/request errors, a video's `currentTime` advances while hovered, and it is paused after `mouseleave`.
3. After pushing, poll `gh api repos/jeffdt/homepage/pages/builds/latest --jq .status` until `built`, then `curl` the asset URL on `jeffdt.com` directly.
4. **Check `cf-cache-status` on that curl.** Cloudflare edge-caches these for 4 hours (`max-age=14400`). If you're replacing an existing preview at the same filename, a stale edge copy can serve `HIT` after deploy — purge it explicitly via the Cloudflare MCP (`purge_cache` with the specific file URLs) rather than waiting it out or telling the user to hard-refresh.

## Per-tool notes

Append a subsection here whenever a new tool gets a preview — this list is expected to grow.

**rastermaster** — start the clip at ~0.7s (after the form's fade-in). Fill `#stockWidth` / `#stockHeight` with a realistic pair (e.g. 24x6, like actual stock dimensions) rather than an arbitrary square; blur the field and move the mouse away afterward or a tooltip (`Measure tallest dimension...`) sticks in the frame. Clicking `#generateBtn` scrolls the pass-schedule table into view, which is a nice bit of free motion. The X-axis/Y-axis direction toggle button visually activates but does **not** redraw the toolpath preview — skip it, it reads as broken.

**discography** — click the `Randomize` button rather than trying to navigate directories by double-click (unreliable/flaky in headless Chromium, not worth debugging further). Launch Chromium with `--autoplay-policy=no-user-gesture-required` or the AudioContext stays suspended and the visualizer never animates. The visualizer takes ~2s to fill after Randomize, so start the clip around 2.5s into the recording. The CRT grain overlay that wrecked GIF compression is a non-issue for H.264.

**rolomux / boomerang / teleport** — Path A (VHS), live-linked from their own repos via jsDelivr, no local copy. Currently pointing at `organize.gif`, `quick-capture.gif`, and `worktree.gif` respectively — those were picked as the most demonstrative single tape per tool, not the only one available (each repo has 2-3 demo tapes; see its `docs/demo/`).

**backlog** — no capture path yet. Needs a new `.tape` script written in that repo first, plus a decision on real synced library data vs. fabricated placeholder titles before either path applies.
