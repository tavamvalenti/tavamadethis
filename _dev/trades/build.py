#!/usr/bin/env python3
"""Trade website template.

Builds a one-page local-trade website from a JSON file per business.
  python3 _dev/trades/build.py            # builds every sites/*.json
  python3 _dev/trades/build.py painting   # builds one

Each JSON file in sites/ describes one business (name, phone, colors, copy,
photos, services, reviews...). The output goes to the "out" path in the JSON,
e.g. trades/painting/index.html. To make a site for a real client, copy a
sample JSON, change the words, photos and colors, set "sample": false and
build. Nothing else needs to change.
"""
import html, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
CSS = (HERE / 'template.css').read_text()

PHONE_ICON = '<svg aria-hidden="true"><use href="#i-phone"/></svg>'
STARS = '<div class="stars" aria-label="5 stars">' + '<svg><use href="#i-star"/></svg>' * 5 + '</div>'


def e(s):
    """Escape plain text. Strings may use *word* for an italic accent."""
    out = html.escape(s, quote=True)
    parts = out.split('*')
    return ''.join(p if i % 2 == 0 else f'<em>{p}</em>' for i, p in enumerate(parts))


def a(s):
    return html.escape(s, quote=True)


def build(cfg):
    c = cfg
    img = c['img'].rstrip('/')
    tel = 'tel:+1' + ''.join(ch for ch in c['phone'] if ch.isdigit())
    pal = c['palette']
    vars_ = '\n'.join(f'  --{k}:{v};' for k, v in pal.items())
    css = CSS.replace('{{VARS}}', vars_)
    hero = c['hero']
    sizes = hero.get('widths', [960, 1600, 2560])
    srcset = ', '.join(f'/{img}/hero-{w}.webp {w}w' for w in sizes)
    mid = sizes[1] if len(sizes) > 1 else sizes[0]
    big = sizes[-1]
    hw, hh = hero['size']

    trust = ''.join(
        f'<li><svg aria-hidden="true"><use href="#i-{t.get("icon", "check")}"/></svg>{e(t["text"])}</li>'
        for t in c['trust'])

    ba = c['before_after']
    bw, bh = ba.get('size', [1168, 880])

    def card(s):
        return (f'<article class="card rv"><div class="ph"><img src="/{img}/{s["img"]}-640.webp" alt="{a(s["alt"])}" '
                f'width="640" height="{round(640 * bh / bw)}" loading="lazy" decoding="async"></div>'
                f'<div class="tx"><h3>{e(s["title"])}</h3><p>{e(s["text"])}</p></div></article>')
    services = '\n      '.join(card(s) for s in c['services'])

    steps = '\n      '.join(f'<li class="rv"><h3>{e(s["title"])}</h3><p>{e(s["text"])}</p></li>' for s in c['steps']['items'])

    gal = []
    for i, g in enumerate(c['gallery']):
        src = f'/{img}/hero-960.webp' if g['img'] == 'hero' else f'/{img}/{g["img"]}-640.webp'
        w, h = (960, round(960 * hh / hw)) if g['img'] == 'hero' else (640, round(640 * bh / bw))
        gal.append(f'<figure><img src="{src}" alt="{a(g["alt"])}" width="{w}" height="{h}" loading="lazy" decoding="async"><figcaption>{e(g["caption"])}</figcaption></figure>')
    gallery = '\n      '.join(gal)

    revs = '\n      '.join(
        f'<figure class="rev rv">{STARS}<blockquote>"{e(r["quote"])}"</blockquote>'
        f'<figcaption><i>{a("".join(w[0] for w in r["name"].replace(".", "").split()[:2]).upper())}</i><div>{e(r["name"])}<span>{e(r["detail"])}</span></div></figcaption></figure>'
        for r in c['reviews']['items'])

    ab = c['about']
    facts = ''.join(f'<div><b>{e(f["value"])}</b><span>{e(f["label"])}</span></div>' for f in ab['facts'])
    towns = ''.join(f'<li>{e(t)}</li>' for t in ab['towns'])

    est = c['estimate']
    options = ''.join(f'<option>{e(o)}</option>' for o in est['options'])

    links = ''.join(f'<a href="#{k}">{e(v)}</a>' for k, v in c['nav'])
    sample = c.get('sample', True)
    notice = (f'<div class="sample">{e(c["sample_notice"])} <a href="/#contact">Want one for your business?</a></div>'
              if sample else '')
    done_text = ("On a real site this request goes straight to the owner's phone and email. This one is a sample, so nothing was sent."
                 if sample else "Thanks, we got it. We'll call you back within one business day.")
    robots = '<meta name="robots" content="noindex">\n' if sample else ''
    byline = (f'<span>{e(c["footer_note"])}</span><span>A concept by <a href="/">Tava Valenti</a></span>'
              if sample else f'<span>&copy; {e(c["name"])}</span><span>Website by <a href="https://tavamadethis.com">TavaMadeThis</a></span>')
    home = ('<a class="home" href="/" aria-label="Back to tavamadethis.com"><i></i></a>\n      <span class="sep" aria-hidden="true"></span>\n      '
            if sample else '')

    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{a(c["title"])}</title>
<meta name="description" content="{a(c["description"])}">
{robots}<meta name="theme-color" content="{pal["sand"]}">
<link rel="icon" type="image/png" sizes="32x32" href="/img/icon-32.png?v=2">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png?v=2">
<link rel="preload" href="/fonts/fraunces-normal-1.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-normal-4.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" as="image" href="/{img}/hero-{mid}.webp" imagesrcset="{srcset}" imagesizes="100vw">
<!-- Built from the TavaMadeThis trade template (_dev/trades/build.py). Edit the JSON, not this file. -->
<style>
{css}</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-phone" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></symbol>
  <symbol id="i-logo" viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="currentColor"/>{c["logo_svg"]}</symbol>
</svg>

{notice}

<header class="nav">
  <div class="wrap">
    <div class="lhs">
      {home}<a class="brand" href="#top"><svg aria-hidden="true"><use href="#i-logo"/></svg><span><b>{e(c["brand"][0])}</b><span>{e(c["brand"][1])}</span></span></a>
    </div>
    <nav class="links" aria-label="Sections">{links}</nav>
    <a class="btn sun" href="{tel}">{PHONE_ICON}<span class="txt">Call </span><span class="num">{e(c["phone"])}</span></a>
  </div>
</header>

<main id="top">
<section class="hero" style="padding:0">
  <img src="/{img}/hero-{mid}.webp" srcset="{srcset}" sizes="100vw" alt="{a(hero["alt"])}" width="{big}" height="{round(big * hh / hw)}" fetchpriority="high" style="object-position:{hero.get("position", "50% 55%")}">
  <div class="wrap">
    <h1>{e(hero["h1"])}</h1>
    <p class="sub">{e(hero["sub"])}</p>
    <div class="ctas"><a class="btn sun" href="#estimate">{e(hero["cta"])}</a><a class="btn line" href="{tel}">{PHONE_ICON}Call {e(c["phone"])}</a></div>
    <ul class="trust">
      {trust}
    </ul>
  </div>
</section>

<section class="ba-sec" id="work">
  <div class="wrap">
    <div class="head rv">
      <div><p class="eyebrow">{e(ba["eyebrow"])}</p><h2>{e(ba["h2"])}</h2></div>
      <p>{e(ba["text"])}</p>
    </div>
    <div class="ba rv" id="ba" role="img" aria-label="{a(ba["aria"])}" style="aspect-ratio:{bw}/{bh}">
      <img src="/{img}/before.webp" alt="" width="{bw}" height="{bh}" loading="lazy" decoding="async">
      <img class="aft" src="/{img}/after.webp" alt="" width="{bw}" height="{bh}" loading="lazy" decoding="async">
      <span class="tag b">Before</span><span class="tag a">After</span>
      <span class="line" aria-hidden="true"></span>
      <span class="knob" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6-6 6 6 6M15 6l6 6-6 6"/></svg></span>
      <input type="range" min="0" max="100" value="50" aria-label="Compare before and after" tabindex="0">
    </div>
    <div class="ba-cap"><span><b>{e(ba["cap_title"])}</b> &middot; {e(ba["cap_detail"])}</span><span>{e(ba["cap_right"])}</span></div>
  </div>
</section>

<section id="services">
  <div class="wrap">
    <div class="head rv">
      <div><p class="eyebrow">{e(c["services_head"]["eyebrow"])}</p><h2>{e(c["services_head"]["h2"])}</h2></div>
      <p>{e(c["services_head"]["text"])}</p>
    </div>
    <div class="svc">
      {services}
    </div>
  </div>
</section>

<section class="steps-sec">
  <div class="wrap">
    <div class="head rv">
      <div><p class="eyebrow">How it works</p><h2>{e(c["steps"]["h2"])}</h2></div>
      <p>{e(c["steps"]["text"])}</p>
    </div>
    <ol class="steps">
      {steps}
    </ol>
  </div>
</section>

<section id="gallery">
  <div class="wrap">
    <div class="head rv">
      <div><p class="eyebrow">Recent work</p><h2>{e(c["gallery_h2"])}</h2></div>
    </div>
    <div class="gal rv">
      {gallery}
    </div>
  </div>
</section>

<section class="rev-sec" id="reviews">
  <div class="wrap">
    <div class="head rv">
      <div><p class="eyebrow">Reviews</p><h2>{e(c["reviews"]["h2"])}</h2></div>
      <div class="score"><b>{e(c["reviews"]["score"])}</b><div>{STARS}<span>{e(c["reviews"]["count"])}</span></div></div>
    </div>
    <div class="revs">
      {revs}
    </div>
  </div>
</section>

<section id="about">
  <div class="wrap about">
    <img class="rv" src="/{img}/{ab["img"]}-640.webp" srcset="/{img}/{ab["img"]}-640.webp 640w, /{img}/{ab["img"]}.webp {bw}w" sizes="(max-width:860px) 100vw, 50vw" alt="{a(ab["alt"])}" width="{bw}" height="{bh}" loading="lazy" decoding="async">
    <div class="rv">
      <p class="eyebrow">About us</p>
      <h2 style="margin-top:16px">{e(ab["h2"])}</h2>
      <p>{e(ab["text"])}</p>
      <div class="facts">{facts}</div>
      <ul class="towns" aria-label="Service area">{towns}</ul>
    </div>
  </div>
</section>

<section class="est-sec" id="estimate">
  <div class="wrap est">
    <div class="rv">
      <p class="eyebrow">{e(est["eyebrow"])}</p>
      <h2 style="margin-top:16px">{e(est["h2"])}</h2>
      <p style="color:var(--mut)">{e(est["text"])}</p>
      <div class="call"><span>Rather talk now?</span><a href="{tel}">{e(c["phone"])}</a><small>{e(c["hours"])}</small></div>
    </div>
    <form class="rv" id="estform" novalidate>
      <div class="two"><label>Your name<input name="name" autocomplete="name" required></label><label>Phone<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label></div>
      <label>City<input name="city" autocomplete="address-level2" placeholder="e.g. {a(ab["towns"][0])}"></label>
      <label>{e(est["select_label"])}<select name="need">{options}</select></label>
      <label>Anything else we should know?<textarea name="msg" placeholder="{a(est["placeholder"])}"></textarea></label>
      <button class="btn" type="submit">{e(est["button"])}</button>
      <p class="fine">We'll never share your number.</p>
      <div class="done" role="status"><h3>Thanks!</h3><p>{e(done_text)}</p></div>
    </form>
  </div>
</section>
</main>

<footer>
  <div class="wrap">
    <div><b>{e(c["name"])}</b><p>{e(c["footer_desc"])}</p><p>{e(c["license"])}</p></div>
    <div><b>Contact</b><p><a href="{tel}">{e(c["phone"])}</a></p><p>{e(c["hours"])}</p><p>{e(c["city"])}</p></div>
    <div><b>Quick links</b><p><a href="#work">Before &amp; after</a></p><p><a href="#services">Services</a></p><p><a href="#estimate">{e(est["eyebrow"])}</a></p></div>
    <div class="by">{byline}</div>
  </div>
</footer>

<div class="mbar" id="mbar"><a class="btn sun" href="{tel}">{PHONE_ICON}Call now</a><a class="btn" href="#estimate">{e(est["short"])}</a></div>

<script>
(function(){{
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !reduce) {{
    var io = new IntersectionObserver(function(es){{ es.forEach(function(e){{ if (e.isIntersecting) {{ e.target.classList.add('in'); io.unobserve(e.target); }} }}); }}, {{ rootMargin: '0px 0px -8% 0px' }});
    rv.forEach(function(el){{ io.observe(el); }});
  }} else rv.forEach(function(el){{ el.classList.add('in'); }});

  var ba = document.getElementById('ba'), inp = ba.querySelector('input'), auto = 0, drag = false;
  function set(v){{ v = Math.max(0, Math.min(100, v)); ba.style.setProperty('--x', v + '%'); inp.value = v; }}
  function fromX(x){{ var r = ba.getBoundingClientRect(); set((x - r.left) / r.width * 100); }}
  ba.addEventListener('pointerdown', function(e){{ auto++; drag = true; fromX(e.clientX); try {{ ba.setPointerCapture(e.pointerId); }} catch (x) {{}} }});
  ba.addEventListener('pointermove', function(e){{ if (drag) fromX(e.clientX); }});
  ['pointerup','pointercancel'].forEach(function(n){{ ba.addEventListener(n, function(){{ drag = false; }}); }});
  inp.addEventListener('input', function(){{ auto++; set(+inp.value); }});
  ba.addEventListener('keydown', function(e){{ if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {{ auto++; set(+inp.value + (e.key === 'ArrowLeft' ? -5 : 5)); e.preventDefault(); }} }});
  ba.tabIndex = 0;
  function sweep(){{ if (reduce) return; var id = ++auto, t0 = performance.now(), keys = [50, 12, 88, 50], dur = 1300;
    (function step(now){{ if (id !== auto) return; var t = (now - t0) / dur, i = Math.floor(t); if (i >= keys.length - 1) {{ set(50); return; }}
      var f = t - i, k = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; set(keys[i] + (keys[i + 1] - keys[i]) * k); requestAnimationFrame(step); }})(t0); }}
  if ('IntersectionObserver' in window) {{ var bo = new IntersectionObserver(function(es){{ if (es[0].isIntersecting) {{ bo.disconnect(); setTimeout(sweep, 500); }} }}, {{ threshold: .5 }}); bo.observe(ba); }}

  var f = document.getElementById('estform');
  f.addEventListener('submit', function(e){{ e.preventDefault(); if (!f.name.value.trim() || !f.phone.value.trim()) {{ (f.name.value.trim() ? f.phone : f.name).focus(); return; }} f.classList.add('sent'); }});

  var mbar = document.getElementById('mbar'), hero = document.querySelector('.hero'), est = document.getElementById('estimate'), tick = false;
  function onScroll(){{ tick = false; var er = est.getBoundingClientRect(); mbar.classList.toggle('show', scrollY > hero.offsetHeight * .6 && !(er.top < innerHeight * .8 && er.bottom > 0)); }}
  addEventListener('scroll', function(){{ if (!tick) {{ tick = true; requestAnimationFrame(onScroll); }} }}, {{ passive: true }});
  onScroll();
}})();
</script>
</body>
</html>
'''


def main():
    names = sys.argv[1:] or [p.stem for p in sorted((HERE / 'sites').glob('*.json'))]
    for n in names:
        cfg = json.loads((HERE / 'sites' / f'{n}.json').read_text())
        out = ROOT / cfg['out']
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(build(cfg))
        print('built', out.relative_to(ROOT))


if __name__ == '__main__':
    main()
