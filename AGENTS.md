# AGENTS.md

Static links page for jeffdt.com. Plain HTML/CSS/JS, no build step, served via GitHub Pages from `main`.

## After every change

- Open the page locally for review with `open index.html` once a change is implemented, before committing. Do this every time without being asked.
- When `style.css` changes, bump the `?v=` query on its `<link>` in `index.html`. The CDN serves stale CSS otherwise.
