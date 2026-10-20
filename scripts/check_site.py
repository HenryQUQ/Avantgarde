#!/usr/bin/env python3
"""Check published HTML links, assets, fragment targets and accessible labels."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PAGES = [ROOT / "index.html", *(ROOT / name / "index.html"
          for name in ("about", "activities", "membership", "conduct"))]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path, self.ids, self.refs, self.labels = path, [], [], []
        self.h1, self.canonical, self.errors = 0, None, []
        self.feed(path.read_text())

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "h1":
            self.h1 += 1
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href")
        if tag == "img" and "alt" not in attrs:
            self.errors.append("Image missing an alt attribute")
        for attr in ("aria-labelledby", "aria-controls", "aria-describedby"):
            self.labels.extend(attrs.get(attr, "").split())
        for attr in ("href", "src"):
            if attrs.get(attr):
                self.refs.append(attrs[attr])
        for candidate in attrs.get("srcset", "").split(","):
            if candidate.strip():
                self.refs.append(candidate.split()[0])


pages = {p.resolve(): Page(p) for p in PAGES}
errors, count = [], 0
for path, page in pages.items():
    prefix = str(path.relative_to(ROOT))
    errors.extend(f"{prefix}: {error}" for error in page.errors)
    if page.h1 != 1:
        errors.append(f"{prefix}: Expected one h1, found {page.h1}")
    if not page.canonical:
        errors.append(f"{prefix}: Missing canonical URL")
    for identifier, occurrences in Counter(page.ids).items():
        if occurrences > 1:
            errors.append(f"{prefix}: Duplicate id {identifier}")
    for label in page.labels:
        if label not in page.ids:
            errors.append(f"{prefix}: Missing accessible label target {label}")
    for reference in page.refs:
        url = urlsplit(reference)
        if url.scheme or url.netloc:
            continue
        count += 1
        target = (ROOT / unquote(url.path).lstrip("/") if url.path.startswith("/")
                  else path.parent / unquote(url.path)).resolve() if url.path else path
        if target.is_dir():
            target /= "index.html"
        if not target.exists():
            errors.append(f"{prefix}: Missing local target {reference}")
        elif url.fragment:
            destination = pages.get(target)
            if destination is None and target.suffix == ".html":
                destination = Page(target)
            if destination and unquote(url.fragment) not in destination.ids:
                errors.append(f"{prefix}: Missing fragment {reference}")
    if re.search(r"\$\{?(root|title|content|nav|team)\b", path.read_text()):
        errors.append(f"{prefix}: Unresolved template")

css = ROOT / "assets/css/main.css"
for value in re.findall(r'url\(["\']?([^)"\']+)', css.read_text()):
    if not value.startswith(("data:", "http:", "https:", "#")):
        if not (css.parent / value).resolve().exists():
            errors.append(f"CSS: Missing resource {value}")

canonicals = [page.canonical for page in pages.values()]
if len(set(canonicals)) != len(canonicals):
    errors.append("Pages must have distinct canonical URLs")

if errors:
    raise SystemExit("\n".join(errors))
print(f"Passed: {len(pages)} pages; {count} local references; fragments, IDs, image labels and CSS assets.")
