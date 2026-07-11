#!/usr/bin/env python3
"""Generate release_notes.json for Android APK assets from user-facing changes.

Priority:
1. Curated bullets in android/whats_new.md (or whats_new.md at repo root)
2. Otherwise, recent git commits that look end-user relevant
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

# Subjects that are almost never useful on an end-user What's New screen.
NOISE_PATTERN = re.compile(
    r"^(merge|bump version|release|ci:|chore\(|chore:|build\(|build:|style\(|test\(|"
    r"docs\(|docs:|workflow|github|ci |ci-|dependabot)",
    re.IGNORECASE,
)
INFRA_SUBJECT_PATTERN = re.compile(
    r"\b("
    r"workflow|github\s*actions?|ci\b|gradle|keystore|signing|upload\s*key|"
    r"aab\b|artifact|release\s*notes?\s*script|play\s*console|play\s*upload|"
    r"yaml|yml\b|\.github|dockerfile|dependabot|lint\b|prettier|eslint|"
    r"versionCode|versionName|skip ci"
    r")\b",
    re.IGNORECASE,
)
# Conventional types worth showing to end users.
USER_FACING_PREFIX = re.compile(
    r"^(feat|fix|perf)(\([a-zA-Z0-9-]+\))?:\s*",
    re.IGNORECASE,
)
# Strip other conventional prefixes so leftover text can still be scored.
ANY_CONVENTIONAL_PREFIX = re.compile(
    r"^(feat|fix|docs|refactor|perf|chore|build|ci|test|style)(\([a-zA-Z0-9-]+\))?:\s*",
    re.IGNORECASE,
)

# Commits that only touch these paths are treated as non-user-facing.
INFRA_PATH_PREFIXES = (
    ".github/",
    "scripts/",
    "docs/",
)
INFRA_PATH_NAMES = {
    "readme.md",
    "license",
    "license.md",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    "gradlew",
    "gradlew.bat",
    "libs.versions.toml",
    "build.gradle.kts",
    "settings.gradle.kts",
    "gradle.properties",
    "keystore.properties",
}

CURATED_FILENAMES = (
    "whats_new.md",
    "WHAT_IS_NEW.md",
    "user_facing_changes.md",
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


def git_log_range_args(repo_root: Path) -> list[str]:
    """Choose a commit range that roughly matches the last user-facing release.

    Prefer play-v* tags (created by the Play build workflow). Avoid v*-build*
    tags from routine CI APK builds — those are too fine-grained and hide
    real product changes from the What's New fallback.
    """
    play_tags = run_git(["tag", "-l", "play-v*", "--sort=-v:refname"], repo_root)
    if play_tags:
        return [f"{play_tags.splitlines()[0]}..HEAD"]
    return ["-40"]


def find_curated_notes_file(repo_root: Path, android_root: Path) -> Path | None:
    candidates = [
        *[android_root / name for name in CURATED_FILENAMES],
        *[repo_root / name for name in CURATED_FILENAMES],
        android_root / "whats_new.md",
    ]
    seen: set[Path] = set()
    for path in candidates:
        resolved = path.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        if path.is_file() and path.read_text(encoding="utf-8").strip():
            return path
    return None


def strip_html_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)


def parse_curated_features(path: Path, limit: int = 12) -> list[str]:
    """Parse markdown/plain bullets from a curated What's New file."""
    features: list[str] = []
    seen: set[str] = set()
    body = strip_html_comments(path.read_text(encoding="utf-8"))
    for raw in body.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith(("- ", "* ", "+ ")):
            line = line[2:].strip()
        elif re.match(r"^\d+\.\s+", line):
            line = re.sub(r"^\d+\.\s+", "", line).strip()
        else:
            # Ignore non-bullet prose so instructions/headings don't leak in.
            continue
        if not line or line in seen:
            continue
        seen.add(line)
        features.append(line)
        if len(features) >= limit:
            break
    return features


def is_infra_path(path: str) -> bool:
    normalized = path.replace("\\", "/").lstrip("./")
    lower = normalized.lower()
    if any(lower.startswith(prefix.lower()) for prefix in INFRA_PATH_PREFIXES):
        return True
    name = Path(lower).name
    if name in INFRA_PATH_NAMES:
        return True
    if lower.endswith((".yml", ".yaml")) and (
        "/workflows/" in lower or lower.startswith(".github/")
    ):
        return True
    return False


def commit_touches_only_infra(paths: list[str]) -> bool:
    if not paths:
        return False
    return all(is_infra_path(path) for path in paths)


def clean_subject(subject: str) -> tuple[str | None, bool]:
    """Return (cleaned_subject, is_explicitly_user_facing)."""
    subject = subject.strip()
    if not subject or NOISE_PATTERN.match(subject):
        return None, False
    if INFRA_SUBJECT_PATTERN.search(subject) and not USER_FACING_PREFIX.match(subject):
        return None, False

    explicitly_user_facing = bool(USER_FACING_PREFIX.match(subject))
    cleaned = ANY_CONVENTIONAL_PREFIX.sub("", subject).strip()
    if not cleaned:
        return None, False
    if INFRA_SUBJECT_PATTERN.search(cleaned) and not explicitly_user_facing:
        return None, False
    return cleaned, explicitly_user_facing


def iter_commit_subjects_and_files(repo_root: Path) -> list[tuple[str, list[str]]]:
    range_args = git_log_range_args(repo_root)
    # %x1e separates commits; %x1f separates subject from file list.
    raw = run_git(
        [
            "log",
            *range_args,
            "--name-only",
            "--pretty=format:%x1e%s%x1f",
            "--no-merges",
        ],
        repo_root,
    )
    commits: list[tuple[str, list[str]]] = []
    for block in raw.split("\x1e"):
        block = block.strip()
        if not block:
            continue
        if "\x1f" in block:
            subject, files_blob = block.split("\x1f", 1)
        else:
            subject, files_blob = block, ""
        subject = subject.strip()
        files = [line.strip() for line in files_blob.splitlines() if line.strip()]
        if subject:
            commits.append((subject, files))
    return commits


def collect_features_from_git(repo_root: Path, limit: int = 12) -> list[str]:
    features: list[str] = []
    seen: set[str] = set()
    preferred: list[str] = []
    fallback: list[str] = []

    for subject, files in iter_commit_subjects_and_files(repo_root):
        if commit_touches_only_infra(files):
            continue
        cleaned, explicitly_user_facing = clean_subject(subject)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        if explicitly_user_facing:
            preferred.append(cleaned)
        else:
            # Non-conventional commits that touch app/product code can still matter,
            # but only as a secondary fallback after feat/fix/perf.
            if any(not is_infra_path(path) for path in files):
                fallback.append(cleaned)

    for item in preferred + fallback:
        features.append(item)
        if len(features) >= limit:
            break

    if not features:
        features = ["Improved stability and performance"]
    return features


def collect_features(repo_root: Path, android_root: Path, limit: int = 12) -> tuple[list[str], str]:
    curated = find_curated_notes_file(repo_root, android_root)
    if curated is not None:
        features = parse_curated_features(curated, limit=limit)
        if features:
            return features, f"curated:{curated.relative_to(repo_root)}"
    return collect_features_from_git(repo_root, limit=limit), "git"


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    repo_root = root
    while not (repo_root / ".git").exists() and repo_root.parent != repo_root:
        repo_root = repo_root.parent
    if not (repo_root / ".git").exists():
        raise SystemExit("Could not locate git repository root")

    gradle_file = find_gradle_file(root)
    android_root = gradle_file.parent.parent  # .../android/app -> .../android
    version_code, version_name = parse_version(gradle_file)
    assets_dir = gradle_file.parent / "src/main/assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    features, source = collect_features(repo_root, android_root)
    payload = {
        "versionCode": version_code,
        "versionName": version_name,
        "title": "What's New",
        "features": features,
    }

    output = assets_dir / "release_notes.json"
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {output} ({version_name}, code {version_code}, "
        f"{len(features)} features via {source})"
    )


if __name__ == "__main__":
    main()
