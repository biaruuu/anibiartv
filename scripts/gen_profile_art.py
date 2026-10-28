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
# A cracked blood-red sky: a dense web of glowing fractures grows across the whole profile from two impact points,
# black ink creeps in from the edges, glossy blood droplets bead in the cells. Drawn per pixel with numpy (640 x 480).
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.spatial import cKDTree

W, H = 640, 480
_np = np.random.default_rng(7)


def _noise(sigma, seed):
    r = np.random.default_rng(seed).standard_normal((H, W)).astype(np.float32)
    r = gaussian_filter(r, sigma)
    return r / (np.abs(r).max() + 1e-6)


_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
_pts = np.array([((i + .5 + _np.uniform(-.4, .4)) * W / 9, (j + .5 + _np.uniform(-.4, .4)) * H / 7) for j in range(7) for i in range(9)])
_wx, _wy = _noise(26, 1) * 16, _noise(26, 2) * 16
_d, _i = cKDTree(_pts).query(np.stack([(_xx + _wx).ravel(), (_yy + _wy).ravel()], 1), k=2)
_d1, _d2 = _d[:, 0].reshape(H, W), _d[:, 1].reshape(H, W)
_gap = _d2 - _d1
_width = 2.4 + 2.8 * (_noise(50, 3) * .5 + .5)
CRACK = np.clip(1 - _gap / _width, 0, 1) ** 1.4
CORE = np.clip(1 - _gap / (_width * .32), 0, 1)
SHADE = np.clip(_d1 / (_d2 + 1e-3), 0, 1) ** 3
_O1, _O2 = (W * .12, H * .95), (W * .9, H * .12)
DIST = np.minimum(np.hypot(_xx - _O1[0], _yy - _O1[1]), np.hypot(_xx - _O2[0], _yy - _O2[1]) * 1.1) + _noise(40, 4) * 46
MAXR = float(DIST.max())
_bd = np.minimum(np.minimum(_xx, W - _xx), np.minimum(_yy, H - _yy))
BORDER = _bd - _noise(18, 5) * 26
_pulse_n = _noise(90, 6)
BUBBLES = [(*_pts[k] + _np.uniform(-10, 10, 2), _np.uniform(16, 36), _np.uniform(0, TAU)) for k in np.random.default_rng(9).choice(len(_pts), 24, replace=False)]
DROPS = [(np.random.default_rng(i).uniform(), np.random.default_rng(i + 99).uniform(), int(np.random.default_rng(i + 7).choice([1, 1, 2])), np.random.default_rng(i + 50).uniform(2.2, 4.4), np.random.default_rng(i + 80).uniform(0, TAU)) for i in range(26)]


def _over(rgb, a, c, alpha):
    """Premultiplied 'over': rgb (H,W,3), a (H,W); c colour (3,) or (H,W,3); alpha (H,W)."""
    c = np.asarray(c, np.float32)
    if c.ndim == 1:
        c = c[None, None, :]
    rgb[:] = c * alpha[..., None] + rgb * (1 - alpha[..., None])
    a[:] = alpha + a * (1 - alpha)


def _disc(rgb, a, cx, cy, r, alpha, hi=True):
    """A glossy blood bead."""
    x0, x1, y0, y1 = int(max(0, cx - r - 2)), int(min(W, cx + r + 3)), int(max(0, cy - r - 2)), int(min(H, cy + r + 3))
    if x1 <= x0 or y1 <= y0:
        return
    gx, gy = np.meshgrid(np.arange(x0, x1, dtype=np.float32), np.arange(y0, y1, dtype=np.float32))
    d = np.hypot(gx - cx, gy - cy) / r
    m = np.clip((1 - d) * r / 1.5, 0, 1) * alpha
    rim = np.clip(d, 0, 1)[..., None]
    col = np.array([95, 0, 18], np.float32) * (1 - rim) + np.array([255, 44, 70], np.float32) * rim
    sub_rgb, sub_a = rgb[y0:y1, x0:x1], a[y0:y1, x0:x1]
    _over(sub_rgb, sub_a, col, m)
    if hi:
        hd = np.hypot((gx - (cx - r * .35)) / (r * .32), (gy - (cy - r * .4)) / (r * .2))
        _over(sub_rgb, sub_a, (255, 235, 238), np.clip(1 - hd, 0, 1) * .9 * alpha)


def web_frame(reveal_p, idle_p, flash=0.0, creep=1.0):
    """reveal_p: 0..1 growth of the web. idle_p: 0..1 phase of the looping shimmer (pulses, beads, droplets)."""
    r = _ease(reveal_p) * (MAXR + 90)
    rev = np.clip((r - DIST) / 46, 0, 1)
    front = np.exp(-(((r - DIST) / 12) ** 2)) * (1 if reveal_p < 1 else 0)
    rgb = np.zeros((H, W, 3), np.float32)
    a = np.zeros((H, W), np.float32)
    # dark red cells, black near the fractures
    _over(rgb, a, (120, 0, 22), rev * (.24 + .22 * (1 - SHADE)))
    _over(rgb, a, (8, 0, 6), rev * SHADE * .8)
    # ink creeping in from the edges
    ink = np.clip((creep * 64 - BORDER) / 24, 0, 1) * .9
    _over(rgb, a, (5, 0, 5), ink)
    # glossy beads
    for k, (bx, by, br, ph) in enumerate(BUBBLES):
        pulse = 1 + .07 * math.sin(TAU * idle_p + ph)
        vis = float(np.clip((r - math.hypot(bx - _O1[0], by - _O1[1]) * .9) / 60, 0, 1))
        if vis > 0:
            _disc(rgb, a, bx, by, br * pulse * (.4 + .6 * vis), .78 * vis)
    # fractures: wide red bloom, bright core, white-hot growth front
    wave = .72 + .28 * np.sin(TAU * (DIST / 340 - idle_p) + _pulse_n * 2)
    cr = CRACK * rev
    glow = np.clip(gaussian_filter(cr, 5) * 2.4, 0, 1) * wave
    _over(rgb, a, (255, 24, 52), glow * .85)
    _over(rgb, a, (255, 70, 82), np.clip(cr * 1.25, 0, 1) * (.75 + .25 * wave))
    hot = np.clip(CORE * rev * (.55 + .45 * wave) + front * CRACK * 1.5, 0, 1)
    _over(rgb, a, (255, 236, 236), hot * .95)
    # beads of blood sliding down + black ash drifting, looping every cycle
    for x0, y0, cyc, sz, ph in DROPS:
        y = ((y0 + idle_p * cyc) % 1.0) * (H + 30) - 15
        x = (x0 * W + 6 * math.sin(TAU * idle_p * cyc + ph)) % W
        fade = math.sin(math.pi * ((y + 15) / (H + 30))) ** .5 * float(rev[int(np.clip(y, 0, H - 1)), int(x)])
        if fade > .02:
            _disc(rgb, a, x, y, sz, .9 * fade)
    if flash > 0:
        fl = np.exp(-(np.minimum(np.hypot(_xx - _O1[0], _yy - _O1[1]), np.hypot(_xx - _O2[0], _yy - _O2[1])) / 170) ** 2) * flash
        _over(rgb, a, (255, 96, 110), np.clip(fl, 0, 1) * .6)
    out = np.zeros((H, W, 4), np.uint8)
    nz = a > 1e-4
    out[..., :3] = np.where(nz[..., None], np.clip(rgb / np.maximum(a[..., None], 1e-4), 0, 255), 0).astype(np.uint8)
    out[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def _ease(x):
    return ease(x)


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


def webp(frames, name, ms, loop):
    frames[0].save(OUT / name, save_all=True, append_images=frames[1:], duration=ms, loop=loop, quality=68, method=5, alpha_quality=80, minimize_size=False)


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
        # ---- intro (plays once) + idle (loop). Animated WebP: far smaller than APNG and it keeps the alpha.
        n_in, n_id = 40, 30
        intro_f = []
        for i in range(n_in):
            q = i / (n_in - 1)
            intro_f.append(web_frame(min(1, q / .8), 0.0, flash=math.exp(-((q - .04) / .05) ** 2), creep=min(1, q / .8)))
        idle_f = [web_frame(1.0, i / n_id) for i in range(n_id)]
        webp(intro_f, "tybw-intro.webp", 50, 1)  # plays once
        webp(idle_f, "tybw-intro.idle.webp", 100, 0)
        small = [f.resize((320, 240), Image.LANCZOS) for f in idle_f]
        sheet(small, "tybw-intro.sheet.png")
        thumb = Image.new("RGBA", (W, H), (17, 17, 20, 255))
        thumb.alpha_composite(idle_f[0])
        thumb.convert("RGB").resize((200, 150), Image.LANCZOS).save(OUT / "tybw-intro.thumb.png", optimize=True)
        catalog.append({"id": "tybw-intro", "kind": "intro", "label": "Blood War", "apng": "/profile-art/tybw-intro.webp", "idle": "/profile-art/tybw-intro.idle.webp",
                        "sheet": "/profile-art/tybw-intro.sheet.png", "frames": len(small), "cols": 10, "frame_w": 320, "frame_h": 240, "fps": 10.0,
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
        webp(fr, "tybw-frame.webp", 83, 0)
        fr[0].resize((96, 96), Image.LANCZOS).save(OUT / "tybw-frame.thumb.png", optimize=True)
        sheet([f.resize((150, 150), Image.LANCZOS) for f in fr], "tybw-frame.sheet.png")
        catalog.append({"id": "tybw-frame", "kind": "frame", "label": "Blood War", "apng": "/profile-art/tybw-frame.webp", "idle": None,
                        "sheet": "/profile-art/tybw-frame.sheet.png", "frames": n_fr, "cols": 10, "frame_w": 150, "frame_h": 150, "fps": round(1000 / 83, 2), "intro_ms": 0})
        b.close()
    (OUT / "catalog.json").write_text(json.dumps(catalog, indent=1))
    for f in sorted(OUT.glob("*.png")):
        print(f.name, f.stat().st_size // 1024, "KB")
