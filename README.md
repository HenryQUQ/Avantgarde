# The Avant-garde Club — website

The English public website of The Avant-garde Club, an invitation-only community
for audiovisual professionals across the UK and Europe, founded in Birmingham
in 2026.

## Preview

The published files are ordinary HTML, CSS and JavaScript. No installation or
application server is required:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173/>.

## Pages

| URL | Content |
| --- | --- |
| `/` | A short introduction, activity overview and membership invitation |
| `/about/` | Story, community, values and founding team |
| `/activities/` | Activity formats; no invented dates, event reports or bookings |
| `/membership/` | Invitation-only membership, contribution and career support |
| `/conduct/` | The existing eight principles, explicitly identified as a summary |
| `#contact` on every page | Founding-team route and a note about unpublished official contact details |

The main navigation contains About, Activities, Membership and Contact. The Code
of Conduct is linked from Membership and the footer. Original single-page links
such as `/#team`, `/#membership` and `/#conduct` redirect to their new destinations
when JavaScript is available.

## Editing and generating pages

Shared templates avoid maintaining five copies of the navigation and footer.
A small Python script uses only the standard library:

```bash
python3 scripts/build_site.py
python3 scripts/check_site.py
node --check assets/js/main.js
node --check assets/js/strands.js
```

Commit regenerated HTML alongside source changes. Generated files are checked in
so GitHub Pages can continue to serve the repository root without a build job.
The generator adds a content hash to CSS and JavaScript URLs to avoid mixing an
older cached interaction layer with new HTML.

```text
site/
  site.json             Existing club facts, team profiles, principle summaries
  templates/
    base.html           Shared document metadata and asset references
    header.html         Shared navigation
    footer.html         Shared contact area and footer
    marks.html          Original outlined marks and titanium gradients
  pages/                Page-specific content
scripts/
  build_site.py         Deterministic static page generator
  check_site.py         Local link, fragment, asset and markup checks
index.html              Generated homepage
about/index.html        Generated About page
activities/index.html   Generated Activities page
membership/index.html   Generated Membership page
conduct/index.html      Generated principles overview
404.html                Self-contained “No signal” error page
assets/
  css/main.css          Shared typography, layout and responsive styles
  js/main.js            Menu disclosure, old-link redirects, restrained motion
  js/strands.js         Original homepage light field, pause and motion handling
  fonts/                Local Inter variable font and licence
  img/                  Existing brand artwork and vector marks
  icons/                Favicons and touch icon
```

## Content boundaries

- Official club email and LinkedIn URLs have not been supplied. No substitutes,
  placeholder buttons or fabricated official profiles are published.
- The six individual founding-team LinkedIn links are retained from the original
  website and clearly identified as personal profiles.
- The existing Code of Conduct text is a principles overview, not an approved
  full document. No downloadable “official” PDF is generated.
- Activity formats are described without presenting them as scheduled or
  completed events. No event dates, attendance figures or photographs are invented.
- Certificates, authentication, forms and registration are outside this phase.
- Existing abstract imagery is used as brand artwork, not as evidence of a
  real club event. Member and event photography can be added when supplied.

## Design and accessibility

The original centred hero, monogram, outlined wordmark, seal, slogan and silver
light strands are retained. The floating glass navigation and titanium palette
extend to the new pages, with dark and light chapters, generous typography and
simple content lists. The homepage no longer contains multi-viewport sticky scenes.

The mobile navigation is a native-link disclosure on a separate glass sheet.
Its opening and closing transitions can reverse; Escape restores the menu
button's focus, and leaving the header closes it. Closed links are inert.
Same-page anchors move keyboard focus to the destination. Without JavaScript,
the navigation remains visible as two columns on small screens. The light field
has a pause control, pauses offscreen and in background tabs, and adapts its
quality to the device. An explicit pause is remembered for the browser session.
Reduced-motion preferences show static strands and remove
entrance effects. The renderer loads only on the homepage. There are no tracking
scripts or third-party requests during page load.

The original material details extend across the pages: the brand has a soft
hover glow, the monogram and seals catch a pointer-following light, and the glass
navigation indicator follows hover or keyboard focus before returning to the
current page. Links have fine animated underlines and directional arrow feedback.
The Code of Conduct contents track the current reading position.

The homepage keeps the original gentle scroll depth and a single metallic
wordmark sweep, including the stacked mobile mark. Content entrances use the
same short stagger across pages. Short phones and landscape screens have compact
hero compositions; navigation, content and footer respect display safe areas.
Glass navigation and browser theme colour follow the chapter below the header.
Mobile controls and footer links have at least 44px-high targets.

Pointer tracking is limited to fine pointers and stops when an object is left.
It schedules work only on pointer movement, not in a continuous animation loop.
Reduced motion disables tracking, tilt, entrance motion and travelling highlights;
reduced transparency gives the navigation an opaque surface. Decorative seals
remain images and do not add keyboard stops or pretend to be buttons.

## GitHub Pages

The deployment structure remains `main` / repository root, with `.nojekyll`.
No publication or deployment is performed by the build script.

`site/site.json` retains the configured canonical base URL
`https://chenyuanqu.com/Avantgarde/`. Asset and navigation paths are relative and
work at the domain root or under `/Avantgarde/`. If the club adopts its own
domain, update `base_url`, regenerate the pages and configure hosting/DNS
separately. The self-contained 404 page handles the existing project prefix
and a root deployment.

## Licences

- Inter — SIL Open Font License 1.1; see `assets/fonts/Inter-OFL.txt`.
- Pirata One is used as outlined wordmark artwork, not a distributed font.
- Club marks, imagery and copy © 2026 The Avant-garde Club.
