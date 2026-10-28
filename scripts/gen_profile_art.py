"""
Renders the exclusive "Thousand-Year Blood War" profile art (original artwork, inspired by the anime's look:
black ink, blood-red reiatsu, white cracks of light). Three pieces:

  intro  - one-shot full-profile overlay (ink surge, cracks, crescent slash)      -> <id>.png (plays once)
  idle   - the soft loop that stays after the intro (ash, embers, black flames)   -> <id>.idle.png + sheet
  frame  - a 9-slice animated frame around the profile card (border-image)        -> <id>.png

SVG frames are rasterised with headless Chromium (filters, blur, turbulence), then saved as APNG.
Run:  python3 scripts/gen_profile_art.py
"""
import json, math, random
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "public" / "profile-art"
BLK, CR, CR2, WH = "#07020a", "#ff1f3d", "#b3081f", "#ffffff"
TAU = math.tau


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def seg(p, a, b):
    return ease((p - a) / (b - a))


DEFS = f"""
<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="ink" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6"/></filter>
<linearGradient id="plume" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="{BLK}" stop-opacity=".97"/><stop offset=".62" stop-color="#12030a" stop-opacity=".9"/><stop offset="1" stop-color="{CR2}" stop-opacity=".0"/></linearGradient>
<radialGradient id="blood" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="{CR}" stop-opacity=".75"/><stop offset=".5" stop-color="{CR2}" stop-opacity=".25"/><stop offset="1" stop-color="{CR2}" stop-opacity="0"/></radialGradient>
<linearGradient id="band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14040c"/><stop offset="1" stop-color="{BLK}"/></linearGradient>
"""


def svg(w, h, body, view=None):
    vb = view or f"0 0 {w} {h}"
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}"><defs>{DEFS}</defs>{body}</svg>'


def tongue(x, y, L, w, lean):
    """A flame tongue pointing up from (x, y)."""
    return (f"M{x-w:.2f} {y:.2f} C{x-w*1.1:.2f} {y-L*.35:.2f} {x+lean*.5-w*.3:.2f} {y-L*.65:.2f} {x+lean:.2f} {y-L:.2f} "
            f"C{x+lean*.5+w*.6:.2f} {y-L*.55:.2f} {x+w*1.1:.2f} {y-L*.3:.2f} {x+w:.2f} {y:.2f} Z")


# ----------------------------------------------------------------------------------------------------------------- intro
W, H = 160, 90  # 16:9 drawing area, rasterised at 3.5x (560 x 315)
_r = random.Random(11)
CRACKS = []
for _ in range(11):
    x, y = 80 + _r.uniform(-14, 14), 84
    a = math.radians(_r.uniform(-165, -15))
    pts = [(x, y)]
    for _ in range(7):
        a += math.radians(_r.uniform(-28, 28))
        n = _r.uniform(7, 13)
        x, y = x + math.cos(a) * n, y + math.sin(a) * n
        pts.append((x, y))
    CRACKS.append(pts)
PLUMES = [(12 + k * 19.5 + _r.uniform(-4, 4), _r.uniform(46, 82), _r.uniform(11, 17), _r.uniform(0, TAU)) for k in range(8)]


def intro(p):
    body = ""
    # impact flash and blood glow
    flash = math.exp(-((p - 0.14) / 0.05) ** 2) * 0.32
    glow = seg(p, 0.0, 0.3) * (1 - seg(p, 0.62, 0.95))
    body += f'<rect width="{W}" height="{H}" fill="{CR}" opacity="{flash:.3f}"/>'
    body += f'<ellipse cx="80" cy="96" rx="110" ry="60" fill="url(#blood)" opacity="{glow:.3f}"/>'
    # white cracks of light
    cr = seg(p, 0.06, 0.34)
    ca = (1 - seg(p, 0.46, 0.82)) * (1 if p > 0.05 else 0)
    for pts in CRACKS:
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        body += (f'<path d="{d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="{1-cr:.3f}" fill="none" stroke="{CR}" stroke-width="2.2" '
                 f'stroke-linecap="round" stroke-linejoin="round" opacity="{ca*.85:.3f}" filter="url(#soft)"/>')
        body += (f'<path d="{d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="{1-cr:.3f}" fill="none" stroke="{WH}" stroke-width=".7" '
                 f'stroke-linecap="round" stroke-linejoin="round" opacity="{ca:.3f}"/>')
    # black ink plumes rising from the bottom, then dissolving upwards
    rise = seg(p, 0.02, 0.5)
    dis = seg(p, 0.58, 0.97)
    ink = ""
    for k, (cx, hh, ww, ph) in enumerate(PLUMES):
        L = hh * rise * (1 + 0.12 * math.sin(TAU * p * 2 + ph))
        lean = math.sin(TAU * p + ph) * 5
        tip = H + 6 - L - dis * 30
        y0 = H + 10
        d = (f"M{cx-ww:.1f} {y0} C{cx-ww*1.2:.1f} {y0-L*.4:.1f} {cx+lean*.4-ww*.5:.1f} {tip+L*.35:.1f} {cx+lean:.1f} {tip:.1f} "
             f"C{cx+lean*.4+ww*.7:.1f} {tip+L*.3:.1f} {cx+ww*1.2:.1f} {y0-L*.45:.1f} {cx+ww:.1f} {y0} Z")
        ink += f'<path d="{d}" fill="url(#plume)" stroke="{CR}" stroke-width=".7" stroke-opacity=".85"/>'
    body += f'<g filter="url(#ink)" opacity="{(1-dis):.3f}">{ink}</g>'
    # a black crescent slash with a white edge sweeping across
    s = seg(p, 0.36, 0.7)
    if 0 < s < 1:
        cx = -30 + s * 220
        cy = 70 - s * 52
        a = 1 - seg(s, 0.7, 1)
        outer = f"M{cx-36:.1f} {cy+14:.1f} Q{cx-2:.1f} {cy-34:.1f} {cx+40:.1f} {cy-2:.1f} Q{cx+2:.1f} {cy-16:.1f} {cx-36:.1f} {cy+14:.1f} Z"
        body += f'<path d="{outer}" fill="{CR}" opacity="{a*.7:.3f}" filter="url(#soft)" transform="rotate(-20 {cx:.1f} {cy:.1f})"/>'
        body += f'<path d="{outer}" fill="{BLK}" stroke="{WH}" stroke-width=".8" opacity="{a:.3f}" transform="rotate(-20 {cx:.1f} {cy:.1f})"/>'
    return svg(W, H, body)


# ------------------------------------------------------------------------------------------------------------------ idle
_r = random.Random(5)
ASH = [(_r.random(), _r.random(), _r.choice([1, 1, 2]), _r.uniform(.5, 1.6), _r.uniform(0, TAU), _r.choice(["ash", "ash", "ember", "ember", "spirit"])) for _ in range(30)]
FLAMES = [(i / 15 * W + _r.uniform(-2, 2), _r.uniform(11, 24), _r.uniform(3, 5.2), _r.uniform(0, TAU)) for i in range(16)]


def idle(p):
    body = ""
    pulse = .55 + .15 * math.sin(TAU * p)
    body += f'<ellipse cx="80" cy="98" rx="105" ry="46" fill="url(#blood)" opacity="{pulse:.3f}"/>'
    flames = ""
    for x, L, w, ph in FLAMES:
        L *= 1 + .22 * math.sin(TAU * p + ph)
        lean = 4 * math.sin(TAU * p + ph * 2)
        flames += f'<path d="{tongue(x, H + 2, L, w, lean)}" fill="{BLK}" stroke="{CR}" stroke-width=".55" stroke-opacity=".9"/>'
    body += f'<g filter="url(#ink)">{flames}</g>'
    for x0, y0, cyc, size, ph, kind in ASH:
        y = (y0 - p * cyc) % 1.0
        x = (x0 + .03 * math.sin(TAU * p * cyc + ph)) % 1.0
        px, py = x * W, y * (H + 8) - 4
        fade = math.sin(math.pi * y) ** .6
        if kind == "ash":
            body += f'<g transform="translate({px:.1f} {py:.1f}) rotate({math.degrees(TAU*p*cyc+ph):.0f})" opacity="{.95*fade:.2f}"><rect x="{-size:.2f}" y="{-size*.6:.2f}" width="{size*2:.2f}" height="{size*1.2:.2f}" rx=".4" fill="{BLK}" stroke="{CR}" stroke-width=".35"/></g>'
        elif kind == "ember":
            body += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{size*.55:.2f}" fill="#ff5a4d" opacity="{fade:.2f}" filter="url(#glow)"/>'
        else:
            body += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{size*.4:.2f}" fill="{WH}" opacity="{.85*fade:.2f}" filter="url(#glow)"/>'
    return svg(W, H, body)


# ----------------------------------------------------------------------------------------------------------------- frame
FS = 120  # frame drawing box: 120 x 120, border band 40 (the 9-slice corners)
BAND = 40
PERIOD = 40
_r = random.Random(3)
EDGE = [(3 + i * 6.4 + _r.uniform(-1.2, 1.2), _r.uniform(15, 27), _r.uniform(2.4, 3.8), _r.uniform(0, TAU)) for i in range(6)]


def edge(p, shift):
    """The top edge as a tile that repeats every 40 units (copies at -40 / 0 / +40 make it seamless)."""
    out = f'<rect x="-40" y="22" width="200" height="{BAND-22}" fill="url(#band)"/>'
    out += f'<rect x="-40" y="18" width="200" height="22" fill="{CR}" opacity=".22" filter="url(#soft)"/>'
    for k in (-1, 0, 1, 2, 3):
        for x, L, w, ph in EDGE:
            x += k * PERIOD
            L *= 1 + .25 * math.sin(TAU * (p + shift) + ph)
            lean = 4.5 * math.sin(TAU * (p + shift) + ph * 2)
            out += f'<path d="{tongue(x, 30, L, w, lean)}" fill="{BLK}" stroke="{CR}" stroke-width=".6" stroke-opacity=".95"/>'
    # glowing inner edge (the card border) with a slow running highlight
    out += f'<rect x="-40" y="38.6" width="200" height="1.4" fill="{CR}" opacity=".9" filter="url(#glow)"/>'
    for k in (-1, 0, 1, 2, 3):
        hx = ((p + shift) * PERIOD) % PERIOD + k * PERIOD
        out += f'<rect x="{hx-5:.1f}" y="38.8" width="10" height="1" rx=".5" fill="{WH}" opacity=".95"/>'
    # tiny cracks in the band
    for x in (9, 27):
        for k in (-1, 0, 1, 2, 3):
            xx = x + k * PERIOD
            out += f'<path d="M{xx} 38 l2 -4 l-1.5 -3 l2 -3" stroke="{CR}" stroke-width=".5" fill="none" opacity=".85"/>'
    return out


def corner(p):
    """Top-left corner ornament in a 40 x 40 box: two black blades, a blood moon and sparkles."""
    pulse = .8 + .2 * math.sin(TAU * p)
    out = f'<path d="M0 0 H40 L33 6 L40 11 L28 13 L23 20 L19 33 L11 28 L6 40 H0 Z" fill="{BLK}" stroke="{CR}" stroke-width=".8"/>'
    out += f'<path d="M2 2 L36 3 L24 9 L12 12 L9 24 L3 36 Z" fill="#17050d" opacity=".9"/>'
    out += f'<circle cx="14" cy="14" r="9" fill="{CR}" opacity="{.45*pulse:.2f}" filter="url(#soft)"/>'
    out += f'<circle cx="14" cy="14" r="6.2" fill="#ff2a44" stroke="#ff9aa6" stroke-width=".5"/>'
    out += f'<circle cx="16.6" cy="12.2" r="5.3" fill="{BLK}"/>'  # bite -> crescent
    sp = (p * 3) % 1
    for (x, y, o) in ((24, 24, 0), (30, 6, .33), (6, 30, .66)):
        a = max(0, math.sin(math.pi * ((sp + o) % 1))) ** 2
        out += f'<path d="M{x} {y-3*a:.1f} L{x+.8*a:.1f} {y-.8*a:.1f} L{x+3*a:.1f} {y} L{x+.8*a:.1f} {y+.8*a:.1f} L{x} {y+3*a:.1f} L{x-.8*a:.1f} {y+.8*a:.1f} L{x-3*a:.1f} {y} L{x-.8*a:.1f} {y-.8*a:.1f} Z" fill="{WH}" opacity="{a:.2f}" filter="url(#glow)"/>'
    return out


def strip_svg(p, k):
    return svg(120, 40, edge(p, k * .25), view="0 0 120 40")


def corner_svg(p):
    return svg(40, 40, corner(p), view="0 0 40 40")


# ------------------------------------------------------------------------------------------------------------------ main
def shoot(page, html, size):
    page.set_content(f'<html><body style="margin:0;background:transparent;overflow:hidden">{html}</body></html>')
    page.screenshot(path="/tmp/_pa.png", omit_background=True, clip={"x": 0, "y": 0, "width": size[0], "height": size[1]})
    return Image.open("/tmp/_pa.png").convert("RGBA").copy()


def apng(frames, name, ms, loop):
    frames[0].save(OUT / name, save_all=True, append_images=frames[1:], duration=ms, loop=loop, disposal=1, blend=0, optimize=True)


def sheet(frames, name, cols=10):
    fw, fh = frames[0].size
    rows = -(-len(frames) // cols)
    s = Image.new("RGBA", (fw * cols, fh * rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, ((i % cols) * fw, (i // cols) * fh))
    s.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(OUT / name, optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        # ---- intro + idle
        page = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=3.5)
        n_in, n_id = 36, 40
        intro_f = [shoot(page, intro(i / (n_in - 1)), (W, H)) for i in range(n_in)]
        idle_f = [shoot(page, idle(i / n_id), (W, H)) for i in range(n_id)]
        apng(intro_f, "tybw-intro.png", 50, 1)  # plays once
        apng(idle_f, "tybw-intro.idle.png", 75, 0)
        small = [f.resize((280, 158), Image.LANCZOS) for f in idle_f]
        sheet(small, "tybw-intro.sheet.png")
        thumb = Image.new("RGBA", (560, 315), (17, 17, 20, 255))
        thumb.alpha_composite(intro_f[17])
        thumb.alpha_composite(idle_f[10])
        thumb.convert("RGB").resize((200, 112), Image.LANCZOS).save(OUT / "tybw-intro.thumb.png", optimize=True)
        catalog.append({"id": "tybw-intro", "kind": "intro", "label": "Blood War", "apng": "/profile-art/tybw-intro.png", "idle": "/profile-art/tybw-intro.idle.png",
                        "sheet": "/profile-art/tybw-intro.sheet.png", "frames": len(small), "cols": 10, "frame_w": 280, "frame_h": 158, "fps": round(1000 / 75, 2),
                        "intro_ms": n_in * 50})
        # ---- frame (9-slice, 300 x 300, corners 100 px)
        page = b.new_page(viewport={"width": FS, "height": FS}, device_scale_factor=2.5)
        n_fr = 24
        ps = b.new_page(viewport={"width": 120, "height": 40}, device_scale_factor=2.5)
        pc = b.new_page(viewport={"width": 40, "height": 40}, device_scale_factor=2.5)
        fr = []
        for i in range(n_fr):
            p = i / n_fr
            F = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
            top = shoot(ps, strip_svg(p, 0), (120, 40))
            right = shoot(ps, strip_svg(p, 1), (120, 40)).transpose(Image.ROTATE_270)
            bot = shoot(ps, strip_svg(p, 2), (120, 40)).transpose(Image.ROTATE_180)
            left = shoot(ps, strip_svg(p, 3), (120, 40)).transpose(Image.ROTATE_90)
            for im, xy in ((top, (0, 0)), (right, (200, 0)), (bot, (0, 200)), (left, (0, 0))):
                F.alpha_composite(im, xy)
            c = shoot(pc, corner_svg(p), (40, 40))
            F.alpha_composite(c, (0, 0))
            F.alpha_composite(c.transpose(Image.FLIP_LEFT_RIGHT), (200, 0))
            F.alpha_composite(c.transpose(Image.ROTATE_180), (200, 200))
            F.alpha_composite(c.transpose(Image.FLIP_TOP_BOTTOM), (0, 200))
            fr.append(F)
        apng(fr, "tybw-frame.png", 83, 0)
        fr[0].resize((96, 96), Image.LANCZOS).save(OUT / "tybw-frame.thumb.png", optimize=True)
        sheet([f.resize((150, 150), Image.LANCZOS) for f in fr], "tybw-frame.sheet.png")
        catalog.append({"id": "tybw-frame", "kind": "frame", "label": "Blood War", "apng": "/profile-art/tybw-frame.png", "idle": None,
                        "sheet": "/profile-art/tybw-frame.sheet.png", "frames": n_fr, "cols": 10, "frame_w": 150, "frame_h": 150, "fps": round(1000 / 83, 2), "intro_ms": 0})
        b.close()
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=1))
    for f in sorted(OUT.glob("*.png")):
        print(f.name, f.stat().st_size // 1024, "KB")
