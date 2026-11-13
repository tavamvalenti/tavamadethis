#!/usr/bin/env python3
"""Build a private free-sample listing page.

Usage:  python3 _dev/listing-template/build.py _dev/listing-template/listings/<slug>.json
Reads the listing JSON plus the source photos in its src_dir (kept OUTSIDE the repo,
in /mnt/project-files/samples/<slug>/src), and writes c/<slug>/ (index.html + img/).
Needs ffmpeg with libwebp.
"""
import json, os, subprocess, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)

def main(path):
    d = json.load(open(path))
    slug = d["slug"]
    src = d["src_dir"]
    out = os.path.join(ROOT, "c", slug)
    img = os.path.join(out, "img")
    os.makedirs(img, exist_ok=True)

    # hero (4K upscaled photo) and night (4K upscaled AI night edit)
    for w in (1600, 2560, 3840):
        ff("-i", os.path.join(src, d["hero"]), "-vf", f"scale={w}:-1", "-c:v", "libwebp", "-q:v", "78" if w == 3840 else "80", os.path.join(img, f"hero-{w}.webp"))
    ff("-i", os.path.join(src, d["night"]), "-vf", "scale=2560:-1", "-c:v", "libwebp", "-q:v", "78", os.path.join(img, "night-2560.webp"))
    ff("-i", os.path.join(src, d["night"]), "-vf", "scale=1280:-1", "-c:v", "libwebp", "-q:v", "74", os.path.join(img, "night-1280.webp"))
    ff("-i", os.path.join(src, d.get("day", d["hero"])), "-vf", "scale=1280:-1", "-c:v", "libwebp", "-q:v", "74", os.path.join(img, "day-1280.webp"))
    ff("-i", os.path.join(src, d.get("day", d["hero"])), "-vf", "scale=2560:-1", "-c:v", "libwebp", "-q:v", "78", os.path.join(img, "day-2560.webp"))

    # gallery: low-res preview, cropped to remove portal watermarks, no stamp
    gal_html = []
    for i, g in enumerate(d["gallery"]):
        name = f"g{i+1}.webp"
        ff("-i", os.path.join(src, g["file"]), "-vf", f"crop={g['crop']},scale=1200:-1", "-c:v", "libwebp", "-q:v", "70", os.path.join(img, name))
        cls = "abcdef"[i]
        gal_html.append(f'<figure class="{cls}" data-i="{i}"><button type="button" class="zoom" aria-label="Enlarge photo: {html.escape(g["alt"])}"><img src="img/{name}" alt="{html.escape(g["alt"])}" loading="lazy" draggable="false"></button></figure>')

    chips = "".join(f"<li>{html.escape(h)}</li>" for h in d["highlights"])
    agent = d["agent"]
    initials = "".join(p[0] for p in agent.split()[:2]).upper()

    t = open(os.path.join(HERE, "template.html")).read()
    rep = {
        "{{TITLE}}": html.escape(d["street"]),
        "{{STREET}}": html.escape(d["street"]),
        "{{CITY}}": html.escape(d["city_state"]),
        "{{STATUS}}": html.escape(d["status"]),
        "{{PRICE}}": str(d["price"]),
        "{{PRICE_FMT}}": f'${d["price"]:,}',
        "{{BEDS}}": str(d["beds"]),
        "{{BATHS}}": str(d["baths"]),
        "{{SQFT}}": str(d["sqft"]),
        "{{FACT4_VAL}}": str(d["fact4"]["val"]) if d.get("fact4") else (str(d["lot_sqft"]) if d.get("lot_sqft") else str(d["year"])),
        "{{FACT4_LABEL}}": d["fact4"]["label"] if d.get("fact4") else ("Lot sq ft" if d.get("lot_sqft") else "Year built"),
        "{{AI_NOTE}}": "The %s view is an AI-generated preview of the exterior, not a photograph." % d.get("ai_side", "night"),
        "{{AI_FOOT}}": "the %s view is an AI-generated preview" % d.get("ai_side", "night"),
        "{{LI_YEAR}}": f'<li><span>Built</span><span>{d["year"]}</span></li>' if d.get("year") else "",
        "{{LI_MLS}}": f'<li><span>MLS</span><span>{html.escape(d["mls"])}</span></li>' if d.get("mls") else "",
        "{{AGENT}}": html.escape(agent),
        "{{INITIALS}}": initials,
        "{{BROKERAGE}}": html.escape(d["brokerage"]),
        "{{HEADLINE}}": d["headline_html"],
        "{{DESC}}": html.escape(d["description"]),
        "{{CHIPS}}": chips,
        "{{GALLERY}}": "\n      ".join(gal_html),
        "{{NPHOTOS}}": str(len(d["gallery"])),
        "{{GALLERY_JSON}}": json.dumps([{"src": f"img/g{i+1}.webp", "alt": g["alt"]} for i, g in enumerate(d["gallery"])]),
    }
    for k, v in rep.items():
        t = t.replace(k, v)
    open(os.path.join(out, "index.html"), "w").write(t)
    print("built", out)

if __name__ == "__main__":
    main(sys.argv[1])
