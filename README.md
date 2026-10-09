# The Avant-garde Club — website

The public website of **The Avant-garde Club**, an invitation-only community for audiovisual professionals across the United Kingdom and Europe, founded in Birmingham in 2026.

It is a static site — plain HTML, CSS and JavaScript with no build step and no third-party requests — ready for GitHub Pages.

## Structure

```
index.html            The whole site, one page
404.html              "No signal" page, self-contained (served for any missing URL)
.nojekyll             Tells GitHub Pages to publish the files as they are
assets/
  css/main.css        Design tokens, layout, materials, motion
  js/main.js          Light-strand renderer, scroll scenes, navigation, menu, hover effects
  fonts/              Inter (variable, Latin subset) + its OFL licence
  img/                Section imagery (AVIF/WebP/JPEG), share image, brand marks (SVG)
  icons/              Favicons and the Apple touch icon
```

## Preview locally

Any static server works, for example:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Publish on GitHub Pages

1. Push this repository to GitHub (`main` branch).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then choose **`main`** and **`/ (root)`** and save.
3. After a minute the site is live at <https://chenyuanqu.com/Avantgarde/>. The account's user site uses the custom domain `chenyuanqu.com`, so GitHub serves this project under it, and `henryquq.github.io/Avantgarde/` redirects there.

GitHub Pages on a private repository needs a paid GitHub plan; on GitHub Free the repository must be public.

All asset paths are relative, so the site works at any address.

### Giving the club its own domain

Add a `CNAME` file containing the domain (for example `avantgardeclub.co.uk`), point the domain's DNS at GitHub Pages, then update the absolute URLs near the top of `index.html` — `canonical`, `og:url`, `og:image` and the `url`/`logo` entries in the JSON-LD block — so link previews on LinkedIn and elsewhere use the new address. On its own domain the site sits at the root, which `404.html` already handles.

## Editing content

All copy lives in `index.html`, one commented section per part of the page: hero, manifesto, beginnings, vision, community, values, activities, careers, membership, Code of Conduct, founding team and closing. Team members' LinkedIn links are in the "Our founding team" section.

The club marks are inlined once, near the top of `<body>`, as SVG paths (`#p-mono`, `#p-wordmark`) and reused everywhere with `<use>`. Standalone copies are in `assets/img/` (`monogram.svg`, `wordmark.svg`, `emblem.svg`) for other uses.

## Design notes

- **Brand.** The monogram and round emblem are vector traces of the master artwork; the wordmark is outlined from Pirata One, the typeface on the club's certificate and logo lockups. Palette and imagery follow the club deck.
- **Type.** SF Pro on Apple devices (system font); everywhere else the bundled Inter variable font, with size-specific tracking and optical sizing.
- **Motion.** Interactive motion uses critically damped springs (Apple's damping/response model), so every animation can be interrupted and reversed. Scroll scenes derive from one progress value per section and simply play backwards when scrolling up. The hero's light strands are drawn live on a canvas, pause when off-screen, and thin themselves out on slower devices.
- **Accessibility.** Semantic landmarks, a skip link, keyboard-reachable navigation and visible focus rings. `prefers-reduced-motion` replaces travel and parallax with cross-fades and a still frame; `prefers-reduced-transparency` makes glass surfaces solid; `prefers-contrast: more` strengthens text and edges. Without JavaScript the page is complete and static.

## Licences

- **Inter** — SIL Open Font License 1.1, see `assets/fonts/Inter-OFL.txt`.
- **Pirata One** is not shipped as a font; only the wordmark's outlines are used, as logo artwork.
- Club marks, imagery and copy © 2026 The Avant-garde Club.
