#!/usr/bin/env python3
"""Generate release_notes.json for Android APK assets from recent git commits."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

NOISE_PATTERN = re.compile(
    r"^(merge|bump version|release|ci:|chore\(|chore:|build\(|build:|style\(|test\()",
    re.IGNORECASE,
)
CONVENTIONAL_PREFIX = re.compile(
    r"^(feat|fix|docs|refactor|perf)(\([a-zA-Z0-9-]+\))?:\s*",
    re.IGNORECASE,
)


def find_gradle_file(root: Path) -> Path:
    matches = sorted(root.rglob("app/build.gradle.kts"))
    if not matches:
        raise SystemExit(f"Could not find app/build.gradle.kts under {root}")
    return matches[0]


def parse_version(gradle_file: Path) -> tuple[int, str]:
    text = gradle_file.read_text(encoding="utf-8")
    name_match = re.search(r'versionName\s*=\s*"([^"]+)"', text)
    code_match = re.search(r"versionCode\s*=\s*(\d+)", text)
    if not name_match or not code_match:
        raise SystemExit(f"Could not parse version from {gradle_file}")
    return int(code_match.group(1)), name_match.group(1)


def run_git(args: list[str], cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip()


def latest_release_tag(repo_root: Path) -> str | None:
    tags = run_git(["tag", "-l", "v*", "--sort=-v:refname"], repo_root)
    if not tags:
        return None
    return tags.splitlines()[0]


def clean_subject(subject: str) -> str | None:
    subject = subject.strip()
    if not subject or NOISE_PATTERN.match(subject):
        return None
    subject = CONVENTIONAL_PREFIX.sub("", subject)
    subject = subject.strip()
    return subject or None


def collect_features(repo_root: Path, limit: int = 12) -> list[str]:
    previous_tag = latest_release_tag(repo_root)
    log_args = (
        ["log", f"{previous_tag}..HEAD", "--pretty=format:%s", "--no-merges"]
        if previous_tag
        else ["log", "-20", "--pretty=format:%s", "--no-merges"]
    )
    raw = run_git(log_args, repo_root)
    features: list[str] = []
    seen: set[str] = set()
    for line in raw.splitlines():
        cleaned = clean_subject(line)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            features.append(cleaned)
        if len(features) >= limit:
            break
    if not features:
        features = ["Improved stability and performance"]
    return features


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    repo_root = root
    while not (repo_root / ".git").exists() and repo_root.parent != repo_root:
        repo_root = repo_root.parent
    if not (repo_root / ".git").exists():
        raise SystemExit("Could not locate git repository root")

    gradle_file = find_gradle_file(root)
    version_code, version_name = parse_version(gradle_file)
    assets_dir = gradle_file.parent / "src/main/assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    payload = {
        "versionCode": version_code,
        "versionName": version_name,
        "title": "What's New",
        "features": collect_features(repo_root),
    }

    output = assets_dir / "release_notes.json"
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output} ({version_name}, code {version_code}, {len(payload['features'])} features)")


if __name__ == "__main__":
    main()
