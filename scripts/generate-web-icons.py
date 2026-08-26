#!/usr/bin/env python3
"""Rasterizes web/icons/icon.svg's design into the PNG launcher icons the web app manifest needs.

Run after changing the icon design:

    python3 scripts/generate-web-icons.py

Writes web/icons/icon-192.png and web/icons/icon-512.png. Pure standard library (zlib + struct),
so it works on any machine with Python 3 and no image dependencies installed.
"""

from __future__ import annotations

import math
import pathlib
import struct
import zlib

CANVAS = 512.0
SUPERSAMPLE = 3
OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "web" / "icons"
SIZES = (192, 512)

# Palette shared with web/styles.css and android/.../theme/Color.kt.
BG_TOP = (0x1F, 0x1A, 0x33)
BG_BOTTOM = (0x0A, 0x09, 0x12)
ACCENT = (0xA0, 0x7C, 0xF0)
BAR_MUTED = (0xAE, 0xB4, 0xCC)
BAR_INFO = (0x38, 0xBD, 0xF8)
BAR_WARNING = (0xF6, 0xB9, 0x3B)
BAR_SUCCESS = (0x34, 0xD3, 0x99)


def rounded_rect_distance(x, y, x0, y0, x1, y1, radius):
    """Signed distance to a rounded rectangle: negative inside, positive outside."""
    cx = min(max(x, x0 + radius), x1 - radius)
    cy = min(max(y, y0 + radius), y1 - radius)
    return math.hypot(x - cx, y - cy) - radius


def blend(base, layer, alpha):
    return tuple(round(b + (l - b) * alpha) for b, l in zip(base, layer))


def sample(x, y):
    """Colour and alpha of the icon at canvas point (x, y)."""
    if rounded_rect_distance(x, y, 0, 0, CANVAS, CANVAS, 112) > 0:
        return (0, 0, 0), 0.0

    t = (x / CANVAS + y / CANVAS) / 2
    color = tuple(round(top + (bottom - top) * t) for top, bottom in zip(BG_TOP, BG_BOTTOM))

    panel = rounded_rect_distance(x, y, 112, 96, 400, 416, 36)
    if panel <= 0:
        color = blend(color, ACCENT, 0.16)
    if abs(panel) <= 7:  # 14px stroke centred on the panel edge
        color = ACCENT

    for bar_x, bar_y, bar_w, bar_color in BARS:
        if rounded_rect_distance(x, y, bar_x, bar_y, bar_x + bar_w, bar_y + 20, 10) <= 0:
            color = bar_color

    return color, 1.0


BARS = [
    (160, 168, 80, BAR_INFO),
    (264, 168, 88, BAR_MUTED),
    (160, 240, 80, BAR_WARNING),
    (264, 240, 88, BAR_MUTED),
    (160, 312, 80, BAR_SUCCESS),
    (264, 312, 88, BAR_MUTED),
]


def render(size: int) -> bytes:
    scale = CANVAS / size
    step = scale / SUPERSAMPLE
    offset = step / 2
    samples = SUPERSAMPLE * SUPERSAMPLE
    rows = bytearray()

    for py in range(size):
        rows.append(0)  # PNG filter type: none
        base_y = py * scale + offset
        for px in range(size):
            base_x = px * scale + offset
            r = g = b = a = 0.0
            for sy in range(SUPERSAMPLE):
                y = base_y + sy * step
                for sx in range(SUPERSAMPLE):
                    color, alpha = sample(base_x + sx * step, y)
                    r += color[0] * alpha
                    g += color[1] * alpha
                    b += color[2] * alpha
                    a += alpha
            if a == 0:
                rows.extend((0, 0, 0, 0))
            else:
                rows.extend((round(r / a), round(g / a), round(b / a), round(255 * a / samples)))

    return bytes(rows)


def write_png(path: pathlib.Path, size: int, raw: bytes) -> None:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + kind
            + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
        )

    header = struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0)  # RGBA, 8-bit
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        target = OUT_DIR / f"icon-{size}.png"
        write_png(target, size, render(size))
        print(f"[OK] {target.relative_to(OUT_DIR.parent.parent)} ({size}x{size})")


if __name__ == "__main__":
    main()
