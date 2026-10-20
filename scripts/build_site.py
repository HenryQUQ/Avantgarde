#!/usr/bin/env python3
"""Render the club's static pages using only the Python standard library."""

from html import escape
from hashlib import sha256
import json
from pathlib import Path
from string import Template


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "site"
CONFIG = json.loads((SOURCE / "site.json").read_text())
PAGES = {
    "home": ("", "A shared vision. A bold future.",
             "An invitation-only community for audiovisual professionals across the United Kingdom and Europe, founded in Birmingham in 2026."),
    "about": ("about", "About the club",
              "Our story, our values and the people who founded The Avant-garde Club in Birmingham."),
    "activities": ("activities", "Ways we come together",
                   "Explore the club's activity formats, from industry conversations and roundtables to running and tennis."),
    "membership": ("membership", "Membership by invitation",
                   "A place to exchange ideas, share experience and support others in the audiovisual industry."),
    "conduct": ("conduct", "Code of Conduct — principles overview",
                "An overview of the principles of The Avant-garde Club. The full Code of Conduct is not yet published here."),
}


def template(name, values):
    return Template((SOURCE / name).read_text()).substitute(values)


def team_markup():
    people = []
    for person in CONFIG["team"]:
        name, role, initials, url = (escape(person[k], quote=True)
                                     for k in ("name", "role", "initials", "linkedin"))
        people.append(f"""
        <li class="person">
          <span class="person__initials" aria-hidden="true">{initials}</span>
          <div class="person__info"><h3>{name}</h3><p>{role}</p></div>
          <a class="person__link" href="{url}" target="_blank" rel="noopener noreferrer">
            <span>LinkedIn</span><span aria-hidden="true">↗</span>
            <span class="visually-hidden"> — {name} (opens in a new tab)</span>
          </a>
        </li>""")
    return "\n".join(people)


def conduct_markup():
    toc, sections = [], []
    for number, item in enumerate(CONFIG["principles"], 1):
        title, description, slug = (escape(item[k], quote=True)
                                    for k in ("title", "description", "slug"))
        toc.append(f'<li><a href="#{slug}"><span>{number:02}</span>{title}</a></li>')
        sections.append(f"""
        <section class="principle" id="{slug}" aria-labelledby="{slug}-title">
          <span class="principle__number" aria-hidden="true">{number:02}</span>
          <div><h2 id="{slug}-title">{title}</h2><p>{description}</p></div>
        </section>""")
    return "\n".join(toc), "\n".join(sections)


def build():
    toc, principles = conduct_markup()
    asset_version = sha256(
        (ROOT / "assets/css/main.css").read_bytes()
        + (ROOT / "assets/js/main.js").read_bytes()
        + (ROOT / "assets/js/strands.js").read_bytes()
    ).hexdigest()[:12]
    for key, (directory, title, description) in PAGES.items():
        root = "../" if directory else "./"
        url = CONFIG["base_url"].rstrip("/") + "/" + (directory + "/" if directory else "")
        nav = []
        for slug, label in (("about", "About"), ("activities", "Activities"), ("membership", "Membership")):
            current = ' aria-current="page"' if key == slug else ""
            nav.append(f'<a href="{root}{slug}/"{current}>{label}</a>')
        nav.append('<a href="#contact">Contact</a>')
        values = {
            "root": root,
            "asset_version": asset_version,
            "page": key,
            "title": escape(f"{title} — {CONFIG['name']}"),
            "description": escape(description, quote=True),
            "canonical": escape(url, quote=True),
            "base_url": escape(CONFIG["base_url"].rstrip("/") + "/", quote=True),
            "theme": "#050607" if key in ("home", "about", "membership") else "#eff1f3",
            "nav_theme": "dark" if key in ("home", "about", "membership") else "light",
            "marks": (SOURCE / "templates/marks.html").read_text() if key == "home" else "",
            "scene_script": (f'  <script src="{root}assets/js/strands.js?v={asset_version}" defer></script>'
                             if key == "home" else ""),
            "nav": "\n".join(nav),
            "team": team_markup(),
            "conduct_toc": toc,
            "principles": principles,
        }
        values["header"] = template("templates/header.html", values)
        values["footer"] = template("templates/footer.html", values)
        values["content"] = template(f"pages/{key}.html", values)
        destination = ROOT / directory / "index.html"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(template("templates/base.html", values))
        print(destination.relative_to(ROOT))


if __name__ == "__main__":
    build()
