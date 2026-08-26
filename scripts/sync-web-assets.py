#!/usr/bin/env python3
"""Build the serverless web app in docs/app/ from the canonical windows/ sources.

The dashboard in windows/ stays the single source of truth. This script copies
it verbatim, adds the PWA head tags plus the web-only boot script, and stamps
the service worker with a content hash so returning visitors pick up changes.

    python3 scripts/sync-web-assets.py        (Windows: py scripts\\sync-web-assets.py)

Files owned by the web build and never overwritten here:
    web-boot.js, sw.js, manifest.webmanifest, icons/
"""

import hashlib
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "windows")
TARGET = os.path.join(ROOT, "docs", "app")

SYNCED_FILES = ["index.html", "app.js", "config.js", "style.css"]
WEB_ONLY_FILES = ["web-boot.js", "sw.js", "manifest.webmanifest"]

HEAD_ANCHOR = "</head>"
BOOT_ANCHOR = '<script src="app.js'

FONT_IMPORT_RE = re.compile(r"^@import\s+url\(['\"]([^'\"]+)['\"]\);?[ \t]*\r?\n", re.MULTILINE)

HEAD_TAGS = """  <!-- Web app shell — injected by scripts/sync-web-assets.py, do not edit here -->
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#09060e">
  <meta name="color-scheme" content="dark">
  <link rel="icon" href="icons/icon.svg" type="image/svg+xml">
  <link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Workflow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
"""

# A blocking @import stalls every script on the page until the font CSS resolves,
# which on a dead or slow connection means the dashboard does not start at all.
# The web build loads the same fonts without blocking, and falls back to system
# fonts if they never arrive.
FONT_TAGS = """  <link rel="stylesheet" href="%s" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="%s"></noscript>
"""


def fail(message):
    print("[X] " + message, file=sys.stderr)
    sys.exit(1)


def read(path):
    with open(path, "r", encoding="utf-8", newline="") as fh:
        return fh.read()


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def patch_index(html, build, font_url):
    if HEAD_ANCHOR not in html:
        fail("windows/index.html has no </head> — cannot inject the web app shell.")
    if BOOT_ANCHOR not in html:
        fail('windows/index.html has no <script src="app.js"> — cannot inject web-boot.js.')

    head = HEAD_TAGS
    if font_url:
        head += FONT_TAGS % (font_url, font_url)
    html = html.replace(HEAD_ANCHOR, head + HEAD_ANCHOR, 1)

    index = html.index(BOOT_ANCHOR)
    line_start = html.rindex("\n", 0, index) + 1
    indent = html[line_start:index]
    boot_tag = '%s<script src="web-boot.js?v=%s"></script>\n' % (indent, build)
    return html[:line_start] + boot_tag + html[line_start:]


def stamp_service_worker(build):
    path = os.path.join(TARGET, "sw.js")
    text = read(path)
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if line.startswith("const BUILD = "):
            lines[i] = "const BUILD = '%s';" % build
            write(path, "\n".join(lines))
            return
    fail("docs/app/sw.js has no `const BUILD = ...` line to stamp.")


def main():
    if not os.path.isdir(SOURCE):
        fail("Canonical source folder not found: " + SOURCE)
    os.makedirs(TARGET, exist_ok=True)

    for name in WEB_ONLY_FILES:
        if not os.path.isfile(os.path.join(TARGET, name)):
            fail("Missing web app file: docs/app/" + name)

    payloads = {}
    for name in SYNCED_FILES:
        src = os.path.join(SOURCE, name)
        if not os.path.isfile(src):
            fail("Missing source file: windows/" + name)
        payloads[name] = read(src)

    font_url = ""
    match = FONT_IMPORT_RE.search(payloads["style.css"])
    if match:
        font_url = match.group(1)
        payloads["style.css"] = FONT_IMPORT_RE.sub("", payloads["style.css"], count=1)

    digest = hashlib.sha256()
    for name in SYNCED_FILES:
        digest.update(payloads[name].encode("utf-8"))
    digest.update(read(os.path.join(TARGET, "web-boot.js")).encode("utf-8"))
    digest.update(read(os.path.join(TARGET, "manifest.webmanifest")).encode("utf-8"))
    build = digest.hexdigest()[:10]

    for name in SYNCED_FILES:
        text = payloads[name]
        if name == "index.html":
            text = patch_index(text, build, font_url)
        write(os.path.join(TARGET, name), text)
        print("[OK] docs/app/%s" % name)

    if font_url:
        print("[OK] Google Fonts @import moved out of the render-blocking path")

    stamp_service_worker(build)
    print("[OK] docs/app/sw.js stamped build %s" % build)

    icons = os.path.join(TARGET, "icons")
    if not os.path.isdir(icons) or not os.listdir(icons):
        print("[!] docs/app/icons is empty — run: python3 scripts/generate-web-icons.py")

    print("Web app synced from windows/ — publish docs/ with GitHub Pages.")


if __name__ == "__main__":
    main()
