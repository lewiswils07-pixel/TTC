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
- `index.html`: home page, with the founding-member sign-up form
- `how-it-works.html`: the three steps, prices (Free and Club+) and staying safe
- `about.html`: Lewis's story, what we believe, and a few travel photos
- `faq.html`: questions and answers
- `terms.html`: terms of service and privacy policy (placeholder text, not reviewed legal copy)
- `404.html`: page-not-found
- `membership.html`, `connections.html`: redirects to `how-it-works.html`, kept so old links still work
- `styles.css`: the one stylesheet (18px body text, nothing below 15px, light and dark themes)
- `nav.js`: the phone menu
- `img/`: photos, favicon and share image

Design notes: the site is written for an older audience first. Keep text
large and plain, links visible (no icon-only controls), and motion to a
minimum.

## Running locally
Serve the folder with any static server, e.g.:

    python3 -m http.server 8000

then open http://localhost:8000/index.html
