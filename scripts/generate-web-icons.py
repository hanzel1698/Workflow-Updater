#!/usr/bin/env python3
"""Generate the PWA icon set for the Workflow Updater web app.

Draws the app mark (a checkmark on the dashboard's violet gradient tile) with
3x supersampling and writes PNGs using only the standard library, so the icons
can be regenerated on any machine with Python 3:

    python3 scripts/generate-web-icons.py
"""

import os
import struct
import zlib

OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "app", "icons"
)

# Matches --gradient-accent in windows/style.css
GRADIENT_START = (239, 0.84, 0.67)  # hsl(239, 84%, 67%)
GRADIENT_END = (262, 0.83, 0.68)  # hsl(262, 83%, 68%)

SS = 3  # supersampling factor per axis


def hsl_to_rgb(h, s, l):
    c = (1 - abs(2 * l - 1)) * s
    hp = (h % 360) / 60.0
    x = c * (1 - abs(hp % 2 - 1))
    if hp < 1:
        r, g, b = c, x, 0
    elif hp < 2:
        r, g, b = x, c, 0
    elif hp < 3:
        r, g, b = 0, c, x
    elif hp < 4:
        r, g, b = 0, x, c
    elif hp < 5:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    m = l - c / 2
    return tuple(int(round((v + m) * 255)) for v in (r, g, b))


C1 = hsl_to_rgb(*GRADIENT_START)
C2 = hsl_to_rgb(*GRADIENT_END)


def rounded_rect_contains(u, v, radius):
    """u, v in [0,1]; radius as a fraction of the side."""
    if radius <= 0:
        return 0.0 <= u <= 1.0 and 0.0 <= v <= 1.0
    if not (0.0 <= u <= 1.0 and 0.0 <= v <= 1.0):
        return False
    cx = min(max(u, radius), 1 - radius)
    cy = min(max(v, radius), 1 - radius)
    dx, dy = u - cx, v - cy
    return dx * dx + dy * dy <= radius * radius


def dist_to_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    denom = vx * vx + vy * vy
    t = 0.0 if denom == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / denom))
    dx, dy = px - (ax + t * vx), py - (ay + t * vy)
    return (dx * dx + dy * dy) ** 0.5


def sample(u, v, radius, glyph_scale):
    """Return an (r, g, b, a) sample for the unit-square point (u, v)."""
    if not rounded_rect_contains(u, v, radius):
        return (0, 0, 0, 0)

    t = max(0.0, min(1.0, (u + v) / 2.0))
    r = int(round(C1[0] + (C2[0] - C1[0]) * t))
    g = int(round(C1[1] + (C2[1] - C1[1]) * t))
    b = int(round(C1[2] + (C2[2] - C1[2]) * t))

    # Checkmark, laid out in its own centred box of side `glyph_scale`.
    gx = (u - 0.5) / glyph_scale + 0.5
    gy = (v - 0.5) / glyph_scale + 0.5
    stroke = 0.145
    if 0.0 <= gx <= 1.0 and 0.0 <= gy <= 1.0:
        d = min(
            dist_to_segment(gx, gy, 0.14, 0.54, 0.40, 0.79),
            dist_to_segment(gx, gy, 0.40, 0.79, 0.86, 0.22),
        )
        if d <= stroke / 2:
            return (255, 255, 255, 255)
    return (r, g, b, 255)


def render(size, radius, glyph_scale):
    px = bytearray(size * size * 4)
    inv = 1.0 / (size * SS)
    for y in range(size):
        row = y * size * 4
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                v = (y * SS + sy + 0.5) * inv
                for sx in range(SS):
                    u = (x * SS + sx + 0.5) * inv
                    s = sample(u, v, radius, glyph_scale)
                    a = s[3]
                    acc[0] += s[0] * a
                    acc[1] += s[1] * a
                    acc[2] += s[2] * a
                    acc[3] += a
            i = row + x * 4
            if acc[3] == 0:
                continue
            px[i] = int(round(acc[0] / acc[3]))
            px[i + 1] = int(round(acc[1] / acc[3]))
            px[i + 2] = int(round(acc[2] / acc[3]))
            px[i + 3] = int(round(acc[3] / (SS * SS)))
    return bytes(px)


def write_png(path, size, pixels):
    raw = b"".join(
        b"\x00" + pixels[y * size * 4:(y + 1) * size * 4] for y in range(size)
    )

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


SVG_TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Workflow Updater">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{c1}"/>
      <stop offset="1" stop-color="{c2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="113" ry="113" fill="url(#g)"/>
  <path d="M164 {y1} L232 {y2} L352 {y3}" fill="none" stroke="#fff" stroke-width="46"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = [
        # name, size, corner radius (fraction), glyph box (fraction)
        ("icon-192.png", 192, 0.22, 0.56),
        ("icon-512.png", 512, 0.22, 0.56),
        ("icon-maskable-192.png", 192, 0.0, 0.46),
        ("icon-maskable-512.png", 512, 0.0, 0.46),
        ("apple-touch-icon.png", 180, 0.0, 0.56),
        ("favicon-32.png", 32, 0.22, 0.60),
    ]
    for name, size, radius, glyph in targets:
        write_png(os.path.join(OUT_DIR, name), size, render(size, radius, glyph))
        print("[OK] %s (%dx%d)" % (name, size, size))

    # Vector favicon for crisp browser-tab rendering.
    scale = 0.56 * 512
    off = (512 - scale) / 2
    svg = SVG_TEMPLATE.format(
        c1="#%02x%02x%02x" % C1,
        c2="#%02x%02x%02x" % C2,
        y1=round(off + 0.54 * scale),
        y2=round(off + 0.79 * scale),
        y3=round(off + 0.22 * scale),
    )
    with open(os.path.join(OUT_DIR, "icon.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg)
    print("[OK] icon.svg")


if __name__ == "__main__":
    main()
