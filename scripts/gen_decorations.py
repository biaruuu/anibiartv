"""
Renders the animated avatar decorations as sprite strips (one row of frames, transparent PNG).

Each frame is drawn as SVG (gradients, blur, turbulence) and rasterised with headless Chromium,
so shading and glow look like they came from a design app. Run:  python3 scripts/gen_decorations.py
The art is drawn on a 100 x 100 box where the avatar (with its ring) is the circle at 50,50, radius 36.
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "public" / "decorations"
FRAMES = 24
FPS = 12
SIZE = 256


def star(cx, cy, r, extra=""):
    k = r * 0.22
    return (f'<path d="M{cx} {cy-r} L{cx+k} {cy-k} L{cx+r} {cy} L{cx+k} {cy+k} L{cx} {cy+r} L{cx-k} {cy+k} L{cx-r} {cy} L{cx-k} {cy-k} Z" {extra}/>')


def wrap(defs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs>{defs}</defs>{body}</svg>'


def tw(p):
    """Ear twitch: rest, then a quick flick (loops)."""
    kf = [(0, 0), (0.62, 0), (0.70, -8), (0.78, 4), (0.86, -3), (0.93, 1), (1, 0)]
    for (a, x), (b, y) in zip(kf, kf[1:]):
        if a <= p <= b:
            u = (p - a) / (b - a)
            u = u * u * (3 - 2 * u)
            return x + (y - x) * u
    return 0


FUR = """
<linearGradient id="fur" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f4e9ee"/><stop offset="1" stop-color="#d8c3cc"/></linearGradient>
<radialGradient id="inner" cx=".5" cy=".75" r=".8"><stop offset="0" stop-color="#ff9fc8"/><stop offset=".6" stop-color="#f6b7d2"/><stop offset="1" stop-color="#ffe1ee"/></radialGradient>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>
<filter id="blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<radialGradient id="blush"><stop offset="0" stop-color="#ff5fae" stop-opacity=".75"/><stop offset="1" stop-color="#ff5fae" stop-opacity="0"/></radialGradient>
<radialGradient id="sp"><stop offset="0" stop-color="#fff" /><stop offset="1" stop-color="#ffd54a" stop-opacity="0"/></radialGradient>
"""


def tufts(rng, pts, n=7):
    out = ""
    for _ in range(n):
        (x1, y1), (x2, y2) = pts
        t = rng.random()
        x, y = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
        out += f'<path d="M{x:.1f} {y:.1f} q{rng.uniform(-1.4,1.4):.1f} {rng.uniform(-3.2,-1.6):.1f} {rng.uniform(-1,1):.1f} {rng.uniform(-4.2,-2.4):.1f}" stroke="#fff" stroke-width=".7" stroke-linecap="round" fill="none" opacity=".75"/>'
    return out


def cat(p):
    d = tw(p)
    rng = random.Random(4)

    def ear(side):
        # authored for the left ear; the right ear is mirrored
        shape = "M17 41 C13 27 15 15 20.5 8 C22.5 5.6 25.5 6.6 27.5 8.4 C34 12.5 41 17 47 21.5 Z"
        inner = "M22.5 34 C20.2 25 21.5 17 24.5 12.5 C25.4 11.4 26.8 11.8 27.8 12.6 C32 15.6 36 18.4 39.5 21.2 Z"
        g = f'<g transform="rotate({-d if side == "L" else d} 32 33)">'
        g += f'<path d="{shape}" fill="#000" opacity=".35" filter="url(#soft)" transform="translate(.6 1.4)"/>'
        g += f'<path d="{shape}" fill="url(#fur)" stroke="#caa9b6" stroke-width=".7" stroke-linejoin="round"/>'
        g += f'<path d="{inner}" fill="url(#inner)"/>'
        g += f'<path d="{inner}" fill="none" stroke="#e58bb5" stroke-width=".5" opacity=".6"/>'
        g += tufts(rng, ((24, 30), (33, 20)), 8)
        g += tufts(rng, ((17.5, 36), (19.5, 14)), 5)
        g += '<path d="M20 12 C19 20 19 28 18.6 36" stroke="#fff" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".6"/>'
        g += "</g>"
        if side == "R":
            g = f'<g transform="translate(100 0) scale(-1 1)">{g}</g>'
        return g

    body = ear("L") + ear("R")
    # blush
    body += '<ellipse cx="30" cy="61" rx="8" ry="4.6" fill="url(#blush)"/><ellipse cx="70" cy="61" rx="8" ry="4.6" fill="url(#blush)"/>'
    for cx in (30, 70):
        s = 1 if cx < 50 else -1
        body += f'<path d="M{cx-2.4*s} 58.2 l{-1.4*s} 4.6 M{cx+0.2*s} 57.6 l{-1.4*s} 5.2 M{cx+2.8*s} 58.2 l{-1.4*s} 4.6" stroke="#d63d94" stroke-width=".9" stroke-linecap="round" fill="none" opacity=".75"/>'
    # whiskers (tapered, soft)
    sway = math.sin(p * 2 * math.pi) * 0.8
    for side in (-1, 1):
        for k, (y0, dy) in enumerate(((55, -1.0), (61, 0.2), (67, 1.6))):
            x0 = 50 + side * 31
            x1 = 50 + side * 43
            y1 = y0 + dy * 2.2 + sway * (1 if k != 1 else 0.4)
            body += f'<path d="M{x0} {y0} Q{(x0+x1)/2} {y0+dy*0.5+sway*0.5:.2f} {x1} {y1:.2f}" stroke="#f4eef2" stroke-width="1.15" stroke-linecap="round" fill="none" opacity=".92"/>'
    # sparkle
    k = 0.5 - 0.5 * math.cos(2 * math.pi * p)
    body += f'<g filter="url(#glow)" opacity="{.35+.65*k:.2f}" transform="translate(86 24) rotate({k*20:.1f}) scale({.6+.5*k:.2f})">' + star(0, 0, 5.4, 'fill="#fff6c8"') + '</g>'
    body += f'<circle cx="92" cy="33" r="{.7+.5*(1-k):.2f}" fill="#ffe9a6" opacity="{.4+.5*(1-k):.2f}"/>'
    return wrap(FUR, body)


def bunny(p):
    d = tw(p) * 0.9
    sway = math.sin(2 * math.pi * p) * 1.6
    rng = random.Random(9)

    def ear(side):
        shape = "M27 30 C19 17 19 4 26 1.8 C33 -0.2 38.6 9 38.4 20 C38.3 24 37.6 28 36.8 31 Z"
        inner = "M29.4 27 C25.4 18 25.6 9.6 28.2 6.8 C31 4 34.2 11 34.4 19.6 C34.4 22.6 33.8 25 33.2 27.4 Z"
        g = f'<g transform="rotate({(-d - sway) if side == "L" else (d + sway)} 32 32)">'
        g += f'<path d="{shape}" fill="#000" opacity=".35" filter="url(#soft)" transform="translate(.6 1.4)"/>'
        g += f'<path d="{shape}" fill="url(#fur)" stroke="#caa9b6" stroke-width=".7"/>'
        g += f'<path d="{inner}" fill="url(#inner)"/>'
        g += tufts(rng, ((29.5, 24), (33, 10)), 7)
        g += '<path d="M24 24 C22.4 17 22.8 8 25.2 4.4" stroke="#fff" stroke-width="1.1" stroke-linecap="round" fill="none" opacity=".65"/>'
        g += "</g>"
        if side == "R":
            g = f'<g transform="translate(100 0) scale(-1 1)">{g}</g>'
        return g

    body = ear("L") + ear("R")
    k = 0.5 - 0.5 * math.cos(2 * math.pi * p + 1.3)
    body += f'<g filter="url(#glow)" opacity="{.3+.7*k:.2f}" transform="translate(76 20) scale({.5+.5*k:.2f})">' + star(0, 0, 4.2, 'fill="#ffe3f1"') + '</g>'
    return wrap(FUR, body)


def halo(p):
    bob = math.sin(2 * math.pi * p) * 1.8
    defs = """
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8860b"/><stop offset=".25" stop-color="#ffe27a"/><stop offset=".5" stop-color="#fff6c8"/><stop offset=".75" stop-color="#ffd24a"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
<filter id="gl" x="-40%" y="-200%" width="180%" height="500%"><feGaussianBlur stdDeviation="2.6"/></filter>
<filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
"""
    cy = 9 + bob
    body = f'<ellipse cx="50" cy="{cy}" rx="21" ry="6" fill="none" stroke="#ffd54a" stroke-width="5" opacity=".55" filter="url(#gl)"/>'
    # back half (darker) then front half (bright) for a 3D torus feel
    body += f'<path d="M29 {cy} A21 6 0 0 1 71 {cy}" fill="none" stroke="#a9780d" stroke-width="3" stroke-linecap="round"/>'
    body += f'<path d="M29 {cy} A21 6 0 0 0 71 {cy}" fill="none" stroke="url(#gold)" stroke-width="3.4" stroke-linecap="round"/>'
    body += f'<path d="M31 {cy+0.3} A19 5.2 0 0 0 69 {cy+0.3}" fill="none" stroke="#fffbe0" stroke-width=".9" stroke-linecap="round" opacity=".85"/>'
    for i in range(2):
        a = 2 * math.pi * (p + i * 0.5)
        x, y = 50 + 21 * math.cos(a), cy + 6 * math.sin(a)
        front = math.sin(a) > 0
        body += f'<g filter="url(#glow)" opacity="{1 if front else .45}" transform="translate({x:.1f} {y:.1f}) scale(.9)">' + star(0, 0, 3.6, 'fill="#fffbe0"') + '</g>'
    return wrap(defs, body)


def crown(p):
    defs = """
<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".35" stop-color="#ffd24a"/><stop offset=".7" stop-color="#d9a21b"/><stop offset="1" stop-color="#8a5a06"/></linearGradient>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="ruby" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffb3c0"/><stop offset=".45" stop-color="#e0173d"/><stop offset="1" stop-color="#6b0420"/></radialGradient>
<radialGradient id="sapph" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#c8e6ff"/><stop offset=".45" stop-color="#2f7de1"/><stop offset="1" stop-color="#0b2a66"/></radialGradient>
<clipPath id="cp"><path id="cs" d="M28 22 L30 5 Q30.4 3.4 31.8 4.4 L41 13 L48.6 2.4 Q50 .8 51.4 2.4 L59 13 L68.2 4.4 Q69.6 3.4 70 5 L72 22 Q50 25 28 22 Z"/></clipPath>
<filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
"""
    body = '<path d="M28 22 L30 5 L41 13 L50 2 L59 13 L70 5 L72 22 Q50 25 28 22 Z" fill="#000" opacity=".4" filter="url(#soft)" transform="translate(0 1.4)"/>'
    body += '<use href="#cs" fill="url(#metal)" stroke="#7a4f05" stroke-width=".7" stroke-linejoin="round"/>'
    body += '<g clip-path="url(#cp)">'
    sx = -30 + 160 * ((p * 1.0) % 1)
    body += f'<g transform="translate({sx:.1f} 0) skewX(-20)"><rect x="0" y="-5" width="16" height="40" fill="url(#shine)"/></g>'
    body += '<path d="M28 20.2 Q50 23.2 72 20.2" stroke="#7a4f05" stroke-width=".6" fill="none" opacity=".7"/>'
    body += '<path d="M30 6 L41 14 L49 3.6" stroke="#fff6c8" stroke-width=".7" fill="none" opacity=".8"/>'
    body += '</g>'
    # gems
    def gem(cx, cy, r, fill):
        s = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{fill})" stroke="#5a3a04" stroke-width=".4"/>'
        s += f'<ellipse cx="{cx-r*.3}" cy="{cy-r*.35}" rx="{r*.35}" ry="{r*.22}" fill="#fff" opacity=".85"/>'
        return s
    body += gem(50, 14, 3, "ruby") + gem(37, 18, 2.2, "sapph") + gem(63, 18, 2.2, "sapph")
    for i, (x, y) in enumerate(((31.5, 3.8), (50, 1.4), (68.5, 3.8))):
        k = 0.5 - 0.5 * math.cos(2 * math.pi * (p + i / 3))
        body += f'<g filter="url(#glow)" opacity="{.15+.85*k:.2f}" transform="translate({x} {y}) scale({.4+.7*k:.2f})">' + star(0, 0, 3.6, 'fill="#fffbe0"') + '</g>'
    return wrap(defs, body)


def flames(p):
    th = 2 * math.pi * p
    dx, dy = 9 * math.cos(th), 9 * math.sin(th)
    defs = f"""
<radialGradient id="fg" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="48"><stop offset=".6" stop-color="#fff2a8"/><stop offset=".72" stop-color="#ffc83d"/><stop offset=".84" stop-color="#ff7a1a"/><stop offset=".95" stop-color="#e3260a"/><stop offset="1" stop-color="#8a0d06"/></radialGradient>
<filter id="fl" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
  <feTurbulence type="fractalNoise" baseFrequency="0.05 0.085" numOctaves="3" seed="7" result="n"/>
  <feOffset in="n" dx="{dx:.2f}" dy="{dy:.2f}" result="no"/>
  <feDisplacementMap in="SourceGraphic" in2="no" scale="13" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="fl2" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140">
  <feTurbulence type="fractalNoise" baseFrequency="0.07 0.11" numOctaves="2" seed="21" result="n"/>
  <feOffset in="n" dx="{-dx*0.8:.2f}" dy="{dy*0.8:.2f}" result="no"/>
  <feDisplacementMap in="SourceGraphic" in2="no" scale="8" xChannelSelector="G" yChannelSelector="R"/>
</filter>
<filter id="gl" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140"><feGaussianBlur stdDeviation="3.4"/></filter>
<filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
"""
    body = '<circle cx="50" cy="50" r="41" fill="none" stroke="#ff5a14" stroke-width="9" opacity=".55" filter="url(#gl)"/>'
    body += '<g filter="url(#fl)"><circle cx="50" cy="50" r="41" fill="none" stroke="url(#fg)" stroke-width="7.5"/></g>'
    body += '<g filter="url(#fl2)"><circle cx="50" cy="50" r="38.6" fill="none" stroke="#fff6c0" stroke-width="2.6" opacity=".9"/></g>'
    rng = random.Random(11)
    for i in range(14):
        a0 = rng.uniform(0, 2 * math.pi)
        r0 = 43 + rng.uniform(-1, 3)
        ph = (p + rng.random()) % 1
        life = ph
        rr = r0 + life * rng.uniform(8, 15)
        a = a0 + math.sin(life * 6 + i) * 0.08
        x, y = 50 + rr * math.cos(a), 50 + rr * math.sin(a)
        op = max(0, 1 - life) ** 1.3
        body += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{(1.3 - life*.8)*rng.uniform(.7,1.3):.2f}" fill="#ffb347" opacity="{op:.2f}" filter="url(#glow)"/>'
    return wrap(defs, body)


def frost(p):
    rng = random.Random(5)
    defs = """
<linearGradient id="ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4fcff"/><stop offset=".5" stop-color="#9fe0ff"/><stop offset="1" stop-color="#4aa8e8"/></linearGradient>
<linearGradient id="spk" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7fd0ff" stop-opacity=".9"/><stop offset=".6" stop-color="#d9f4ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
<filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="gl" filterUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="140"><feGaussianBlur stdDeviation="2.6"/></filter>
"""
    body = '<circle cx="50" cy="50" r="38.5" fill="none" stroke="#7ad7ff" stroke-width="4" opacity=".5" filter="url(#gl)"/>'
    body += '<circle cx="50" cy="50" r="38.2" fill="none" stroke="url(#ice)" stroke-width="2.4"/>'
    body += '<circle cx="50" cy="50" r="37.2" fill="none" stroke="#fff" stroke-width=".6" opacity=".7"/>'
    n = 26
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.05, 0.05)
        L = rng.choice((5, 7.5, 10, 12.5)) * rng.uniform(.85, 1.15)
        w = rng.uniform(1.3, 2.3)
        sh = 0.55 + 0.45 * math.sin(2 * math.pi * (p + i * 0.137))
        deg = math.degrees(a) + 90
        body += (f'<g transform="translate(50 50) rotate({deg:.1f}) translate(0 -38.4)" opacity="{.55+.45*sh:.2f}">'
                 f'<path d="M{-w:.2f} 0 L0 {-L:.2f} L{w:.2f} 0 Z" fill="url(#spk)"/>'
                 f'<path d="M0 0 L0 {-L:.2f}" stroke="#fff" stroke-width=".35" opacity=".8"/></g>')
    for i in range(4):
        a = 2 * math.pi * (i / 4 + 0.08) + 0.2
        r = 44 + (i % 2) * 5
        k = 0.5 - 0.5 * math.cos(2 * math.pi * (p + i / 4))
        x, y = 50 + r * math.cos(a), 50 + r * math.sin(a)
        body += f'<g filter="url(#glow)" opacity="{.2+.8*k:.2f}" transform="translate({x:.1f} {y:.1f}) rotate({k*30:.1f}) scale({.4+.7*k:.2f})">' + star(0, 0, 4.2, 'fill="#ffffff"') + '</g>'
    return wrap(defs, body)


ART = {"bunny": bunny, "halo": halo, "crown": crown, "flames": flames, "frost": frost}

COLS = 10
# label, art scale (decoration box / avatar picture width), fps
META = {
    "cozy-cat": ("Cat ears", 1.2, None),
    "violet-flame": ("Violet flames", 1.2, None),
    "neon-ring": ("Neon ring", 1.2, None),
    "butterflies": ("Butterflies", 1.2, None),
    "sunburst": ("Sunburst", 1.2, None),
    "droplets": ("Droplets", 1.2, None),
    "storm": ("Lightning", 1.2, None),
    "hearts": ("Hearts", 1.2, None),
    "bunny": ("Bunny", 1.5, FPS),
    "halo": ("Halo", 1.5, FPS),
    "crown": ("Crown", 1.5, FPS),
    "flames": ("Flames", 1.5, FPS),
    "frost": ("Frost", 1.5, FPS),
}


def save(name, frames, duration_ms, apng=True):
    """frames: list of RGBA images of equal size -> animated PNG for the page + a grid sheet for canvas."""
    fw, fh = frames[0].size
    if apng:
        frames[0].save(OUT / f"{name}.png", save_all=True, append_images=frames[1:], duration=duration_ms, loop=0, disposal=1, blend=0, optimize=True)
    # small still preview for the picker (so opening Edit profile does not download every animation)
    th = frames[0].resize((96, 96), Image.LANCZOS)
    th.save(OUT / f"{name}.thumb.png", optimize=True)
    if len(frames) > 70:  # very long loops: the sprite sheet keeps every 2nd frame (the page still plays the original)
        frames = frames[::2]
        duration_ms *= 2
    rows = -(-len(frames) // COLS)
    sheet = Image.new("RGBA", (fw * COLS, fh * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % COLS) * fw, (i // COLS) * fh))
    # 256 colours with transparency keeps the sheets small (the artwork is palette based anyway)
    sheet.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(OUT / f"{name}.sheet.png", optimize=True)
    label, scale, _ = META[name]
    return {"id": name, "label": label, "apng": f"/decorations/{name}.png", "sheet": f"/decorations/{name}.sheet.png", "frames": len(frames), "cols": COLS, "frame_size": fw, "fps": round(1000 / duration_ms, 2), "scale": scale}


if __name__ == "__main__":
    from PIL import ImageSequence
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = []
    # supplied animated decorations (APNG files in scripts/source): every frame composited, timing kept
    import shutil
    for srcfile in sorted((Path(__file__).resolve().parent / "source").glob("*.apng.png")):
        name = srcfile.name.removesuffix(".apng.png")
        src = Image.open(srcfile)
        dur = src.info.get("duration", 83)
        frames = [f.convert("RGBA").copy() for f in ImageSequence.Iterator(src)]
        catalog.append(save(name, frames, dur, apng=False))
        shutil.copyfile(srcfile, OUT / f"{name}.png")  # keep the original (smaller) animated file for the page
    only = sys.argv[1:] or list(ART)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        page = b.new_page(viewport={"width": 100, "height": 100}, device_scale_factor=SIZE / 100)
        for name in only:
            fr = []
            for f in range(FRAMES):
                page.set_content(f'<html><body style="margin:0;background:transparent;overflow:hidden">{ART[name](f / FRAMES)}</body></html>')
                page.screenshot(path="/tmp/_deco_frame.png", omit_background=True, clip={"x": 0, "y": 0, "width": 100, "height": 100})
                fr.append(Image.open("/tmp/_deco_frame.png").convert("RGBA").copy())
            catalog.append(save(name, fr, round(1000 / FPS)))
        b.close()
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=1))
    for c in catalog:
        print(c["id"], (OUT / f"{c['id']}.png").stat().st_size // 1024, "KB apng,", (OUT / f"{c['id']}.sheet.png").stat().st_size // 1024, "KB sheet")
