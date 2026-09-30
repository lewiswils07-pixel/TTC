# Together Travel Club (prototype)

Static multi-page prototype, originally built and iterated on as a Claude Artifact.

## Files
- `index.html` — home page
- `about.html` — about page
- `matches.html` — "see a match" demo page (globe + carousel)
- `styles.css` — shared styles for all pages
- `nav.js` — shared nav/menu behaviour
- `img/` — photos + the full-world globe texture used on matches.html

## Running locally
No build step — plain HTML/CSS/JS. Serve the folder with any static server, e.g.:

    python3 -m http.server 8000

then open http://localhost:8000/index.html
