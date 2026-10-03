# Together Travel Club

Static multi-page site for Together Travel Club. Plain HTML/CSS/JS, no build step.

## Two versions, two branches

| Branch | What it is |
|---|---|
| `main` | **Launch version.** Marketing pages and the founding-community sign-up. No sign-in or dashboard. |
| `members-dashboard` | **Members version.** Everything in the launch version, plus a demo sign-in page and member dashboard. |

**The rule: changes only flow one way, launch → members.**

- Shared work (copy, design, pages, fixes) lands on `main` first, then is merged into `members-dashboard`:

      git checkout members-dashboard
      git merge main

- Sign-in/dashboard-only work happens on `members-dashboard` only.
- Never merge `members-dashboard` back into `main`.

(`claude/vigilant-mccarthy-3b4by0` is the working branch Claude Code develops on; its changes are brought into `main`.)

The sign-in and dashboard on the members branch are a **client-side demo only**
(`demo-auth.js`, localStorage): no backend, no real accounts, no security.

## Files
- `index.html`: home page, including the founding-community join form
- `how-it-works.html`, `connections.html`, `membership.html`, `about.html`: main pages
- `faq.html`, `terms.html`: footer pages (`terms.html` is placeholder text, not reviewed legal copy)
- `styles.css`: shared styles for all pages
- `nav.js`: shared nav/menu behaviour
- `badges.js`: trust badges on member cards
- `img/`: photos and the globe texture used on connections.html

## Running locally
Serve the folder with any static server, e.g.:

    python3 -m http.server 8000

then open http://localhost:8000/index.html
