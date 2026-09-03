#!/usr/bin/env python3
"""Bluesky Accessibility Observatory publisher.

This program intentionally has no connection to the dashboard process. It
reads only sealed, checksum-verified archive-format-v2 segments and produces
two things: an atomically replaced public aggregate snapshot for the dashboard,
and optional Parquet-native Hugging Face dataset commits.

Jetstream v1 is at-least-once and does not provide sync markers. Event
fingerprints make replay idempotent for seven days; account/deletion markers
can remove selected descriptions, but daily aggregates remain observations at
create time rather than a claim about today's complete network state.
"""
from __future__ import annotations

import argparse
import contextlib
import dataclasses
import datetime as dt
import hashlib
import hmac
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
import time
from collections.abc import Iterable, Iterator
from typing import Any


GIB = 1024 ** 3
STATE_CAP_BYTES = 5 * GIB
HF_SAMPLE_CAP_BYTES = 2 * GIB
SAMPLE_CANDIDATES = 5_000
PUBLISHED_SAMPLES = 2_000
FINGERPRINT_RETENTION_SECONDS = 7 * 24 * 60 * 60
LENGTH_BINS = ((1, 25, "1_25"), (26, 75, "26_75"), (76, 150, "76_150"), (151, 300, "151_300"), (301, None, "301_plus"))
COUNT_FIELDS = (
    "post_total", "image_posts", "images", "images_with_alt",
    "fully_described_image_posts", "alt_characters", "alt_words",
    "alt_descriptions", "len_1_25", "len_26_75", "len_76_150",
    "len_151_300", "len_301_plus",
)
EXPORT_FIELDS = {
    "daily_metrics": (
        "date", "coverage_state", "observed_minutes", "first_cursor",
        "last_cursor", *COUNT_FIELDS, "image_alt_rate",
        "fully_described_post_rate", "collector_git_sha",
        "publication_timestamp",
    ),
    "daily_language_metrics": (
        "date", "language", *COUNT_FIELDS, "image_alt_rate",
        "fully_described_post_rate",
    ),
    "description_sample": (
        "sample_pseudonym", "date", "month", "record_pseudonym",
        "author_pseudonym", "alt_text", "alt_characters", "alt_words",
        "declared_languages", "image_position", "image_count", "mime_type",
        "width", "height", "orientation", "embed_kind", "sampling_weight",
    ),
}


class SegmentError(RuntimeError):
    """A segment is not safe to checkpoint past."""


@dataclasses.dataclass(frozen=True)
class Config:
    raw_dir: pathlib.Path
    state_dir: pathlib.Path
    repo_id: str = "lukeslp/bluesky-alt-text-observatory"
    source_dir: pathlib.Path = pathlib.Path(__file__).resolve().parents[1]
    state_cap_bytes: int = STATE_CAP_BYTES
    sample_repo_cap_bytes: int = HF_SAMPLE_CAP_BYTES
    now: Any = time.time

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            raw_dir=pathlib.Path(os.environ.get("RAW_ARCHIVE_DIR", "/home/coolhand/firehose-data/raw")),
            state_dir=pathlib.Path(os.environ.get("OBSERVATORY_STATE_DIR", "/home/coolhand/firehose-data/observatory")),
            repo_id=os.environ.get("OBSERVATORY_HF_REPO", "lukeslp/bluesky-alt-text-observatory"),
            source_dir=pathlib.Path(os.environ.get("OBSERVATORY_SOURCE_DIR", pathlib.Path(__file__).resolve().parents[1])),
        )


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def json_dump_atomic(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def stream_sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def temporary_path(*, suffix: str) -> pathlib.Path:
    descriptor, name = tempfile.mkstemp(prefix="observatory-", suffix=suffix)
    os.close(descriptor)
    return pathlib.Path(name)


def normalized_languages(record: dict[str, Any]) -> tuple[str, list[str]]:
    raw = record.get("langs")
    if not isinstance(raw, list):
        return "unknown", []
    result: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        value = item.strip().replace("_", "-").lower()
        parts = value.split("-")
        if not parts or not parts[0].isalpha() or not 2 <= len(parts[0]) <= 8:
            continue
        if any(not part.isalnum() or not 1 <= len(part) <= 8 for part in parts[1:]):
            continue
        if value not in result:
            result.append(value)
    return (result[0].split("-", 1)[0] if result else "unknown"), result


def image_descriptions(record: dict[str, Any]) -> tuple[str | None, list[dict[str, Any]]]:
    """Return only image records and normalize fields safe for publication."""
    embed = record.get("embed")
    if not isinstance(embed, dict):
        return None, []
    kind: str | None = None
    images: Any = None
    if embed.get("$type") == "app.bsky.embed.images":
        kind, images = "images", embed.get("images")
    elif embed.get("$type") == "app.bsky.embed.recordWithMedia":
        media = embed.get("media")
        if isinstance(media, dict) and media.get("$type") == "app.bsky.embed.images":
            kind, images = "recordWithMedia", media.get("images")
    if not isinstance(images, list):
        return kind, []

    descriptions: list[dict[str, Any]] = []
    for index, item in enumerate(images, start=1):
        image = item if isinstance(item, dict) else {}
        blob = image.get("image") if isinstance(image.get("image"), dict) else {}
        ratio = image.get("aspectRatio") if isinstance(image.get("aspectRatio"), dict) else {}
        width = ratio.get("width") if isinstance(ratio.get("width"), (int, float)) and ratio.get("width") > 0 else None
        height = ratio.get("height") if isinstance(ratio.get("height"), (int, float)) and ratio.get("height") > 0 else None
        width = int(round(width)) if width is not None else None
        height = int(round(height)) if height is not None else None
        orientation = "unknown"
        if width and height:
            orientation = "square" if width == height else "landscape" if width > height else "portrait"
        descriptions.append({
            "alt": image.get("alt") if isinstance(image.get("alt"), str) else "",
            "image_position": index,
            "image_count": len(images),
            "mime_type": blob.get("mimeType") if isinstance(blob.get("mimeType"), str) else None,
            "width": width,
            "height": height,
            "orientation": orientation,
            "embed_kind": kind,
        })
    return kind, descriptions


def count_words(value: str) -> int:
    return len(value.split())


def length_bin(characters: int) -> str | None:
    for minimum, maximum, label in LENGTH_BINS:
        if characters >= minimum and (maximum is None or characters <= maximum):
            return label
    return None


def event_datetime(event: dict[str, Any]) -> dt.datetime:
    value = event.get("time_us") or event.get("seq")
    try:
        return dt.datetime.fromtimestamp(int(str(value)) / 1_000_000, dt.UTC)
    except (TypeError, ValueError, OSError):
        return utc_now()


def event_fingerprint(event: dict[str, Any]) -> bytes:
    commit = event.get("commit") if isinstance(event.get("commit"), dict) else {}
    account = event.get("account") if isinstance(event.get("account"), dict) else {}
    identity = event.get("identity") if isinstance(event.get("identity"), dict) else {}
    compact = {
        "kind": event.get("kind"), "cursor": event.get("seq") or event.get("time_us"), "did": event.get("did"),
        "operation": commit.get("operation"), "collection": commit.get("collection"), "rkey": commit.get("rkey"),
        "cid": commit.get("cid"), "active": account.get("active"), "handle": identity.get("handle"),
    }
    return hashlib.blake2b(json.dumps(compact, sort_keys=True, separators=(",", ":"), default=str).encode(), digest_size=16).digest()


class Observatory:
    def __init__(self, config: Config):
        self.config = config
        self.config.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.config.state_dir, 0o700)
        self.conn = sqlite3.connect(self.config.state_dir / "state.sqlite3")
        self.conn.row_factory = sqlite3.Row
        self._init_db()
        self.key = self._load_key()
        self._set_default("collector_started_at", utc_now().isoformat())

    def close(self) -> None:
        self.conn.close()

    def _init_db(self) -> None:
        self.conn.executescript("""
          PRAGMA journal_mode=WAL;
          PRAGMA foreign_keys=ON;
          CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS segments (
            path TEXT PRIMARY KEY, sha256 TEXT NOT NULL, last_cursor TEXT, processed_at TEXT NOT NULL, outcome TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS fingerprints (fingerprint BLOB PRIMARY KEY, seen_at INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS daily_minutes (date TEXT NOT NULL, minute TEXT NOT NULL, PRIMARY KEY(date, minute));
          CREATE TABLE IF NOT EXISTS daily_metrics (
            date TEXT PRIMARY KEY, post_total INTEGER NOT NULL DEFAULT 0, image_posts INTEGER NOT NULL DEFAULT 0,
            images INTEGER NOT NULL DEFAULT 0, images_with_alt INTEGER NOT NULL DEFAULT 0,
            fully_described_image_posts INTEGER NOT NULL DEFAULT 0, alt_characters INTEGER NOT NULL DEFAULT 0,
            alt_words INTEGER NOT NULL DEFAULT 0, alt_descriptions INTEGER NOT NULL DEFAULT 0,
            len_1_25 INTEGER NOT NULL DEFAULT 0, len_26_75 INTEGER NOT NULL DEFAULT 0,
            len_76_150 INTEGER NOT NULL DEFAULT 0, len_151_300 INTEGER NOT NULL DEFAULT 0,
            len_301_plus INTEGER NOT NULL DEFAULT 0, first_cursor TEXT, last_cursor TEXT
          );
          CREATE TABLE IF NOT EXISTS daily_language_metrics (
            date TEXT NOT NULL, language TEXT NOT NULL, post_total INTEGER NOT NULL DEFAULT 0,
            image_posts INTEGER NOT NULL DEFAULT 0, images INTEGER NOT NULL DEFAULT 0,
            images_with_alt INTEGER NOT NULL DEFAULT 0, fully_described_image_posts INTEGER NOT NULL DEFAULT 0,
            alt_characters INTEGER NOT NULL DEFAULT 0, alt_words INTEGER NOT NULL DEFAULT 0,
            alt_descriptions INTEGER NOT NULL DEFAULT 0, len_1_25 INTEGER NOT NULL DEFAULT 0,
            len_26_75 INTEGER NOT NULL DEFAULT 0, len_76_150 INTEGER NOT NULL DEFAULT 0,
            len_151_300 INTEGER NOT NULL DEFAULT 0, len_301_plus INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(date, language)
          );
          CREATE TABLE IF NOT EXISTS candidates (
            date TEXT NOT NULL, score BLOB NOT NULL, record_pseudonym TEXT NOT NULL,
            sample_pseudonym TEXT NOT NULL, author_pseudonym TEXT NOT NULL, alt_text TEXT NOT NULL,
            alt_characters INTEGER NOT NULL, alt_words INTEGER NOT NULL, declared_languages TEXT NOT NULL,
            image_position INTEGER NOT NULL, image_count INTEGER NOT NULL, mime_type TEXT,
            width INTEGER, height INTEGER, orientation TEXT NOT NULL, embed_kind TEXT NOT NULL,
            PRIMARY KEY(date, record_pseudonym, image_position)
          );
          CREATE INDEX IF NOT EXISTS candidates_bottom_k ON candidates(date, score DESC);
          CREATE TABLE IF NOT EXISTS published_samples (
            sample_pseudonym TEXT PRIMARY KEY, date TEXT NOT NULL, month TEXT NOT NULL,
            record_pseudonym TEXT NOT NULL, author_pseudonym TEXT NOT NULL, alt_text TEXT NOT NULL,
            alt_characters INTEGER NOT NULL, alt_words INTEGER NOT NULL, declared_languages TEXT NOT NULL,
            image_position INTEGER NOT NULL, image_count INTEGER NOT NULL, mime_type TEXT,
            width INTEGER, height INTEGER, orientation TEXT NOT NULL, embed_kind TEXT NOT NULL,
            sampling_weight REAL NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
          );
          CREATE INDEX IF NOT EXISTS published_samples_month ON published_samples(month, deleted);
          CREATE TABLE IF NOT EXISTS finalized_dates (date TEXT PRIMARY KEY, finalized_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS rewrites (month TEXT PRIMARY KEY, reason TEXT NOT NULL, marked_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS published_files (path TEXT PRIMARY KEY, sha256 TEXT NOT NULL, row_count INTEGER NOT NULL, published_at TEXT NOT NULL);
        """)
        self.conn.commit()

    def _load_key(self) -> bytes:
        key_path = self.config.state_dir / "sampling.key"
        if key_path.exists():
            value = key_path.read_bytes()
            if len(value) >= 32:
                return value
            raise RuntimeError("observatory sampling key is invalid")
        value = os.urandom(32)
        descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        return value

    def _set_default(self, key: str, value: str) -> None:
        self.conn.execute("INSERT OR IGNORE INTO meta(key, value) VALUES(?, ?)", (key, value))
        self.conn.commit()

    def _meta(self, key: str, default: str | None = None) -> str | None:
        row = self.conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return str(row[0]) if row else default

    def _set_meta(self, key: str, value: str) -> None:
        self.conn.execute("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))

    def _pseudonym(self, namespace: str, value: str) -> str:
        token = hmac.new(self.key, f"{namespace}:{value}".encode(), hashlib.sha256).hexdigest()[:32]
        return f"{namespace}_{token}"

    def _state_bytes(self) -> int:
        return sum(path.stat().st_size for path in self.config.state_dir.rglob("*") if path.is_file())

    def sampling_allowed(self) -> bool:
        paused = self._meta("sampling_paused") == "1"
        if self._state_bytes() > self.config.state_cap_bytes:
            self._set_meta("sampling_paused", "1")
            self._set_meta("sampling_pause_reason", "local observatory state cap reached; aggregates continue")
            return False
        return not paused

    def _manifest_segments(self) -> list[tuple[pathlib.Path, dict[str, Any], pathlib.Path]]:
        if not self.config.raw_dir.exists():
            return []
        result: list[tuple[pathlib.Path, dict[str, Any], pathlib.Path]] = []
        for manifest_path in sorted(self.config.raw_dir.rglob("*.manifest.json")):
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                raise SegmentError(f"Unreadable manifest {manifest_path.name}: {error}") from error
            segment_path = manifest_path.with_name(manifest_path.name.replace(".manifest.json", ".ndjson.zst"))
            result.append((segment_path, manifest, manifest_path))
        return result

    def _verify_segment(self, segment: pathlib.Path, manifest: dict[str, Any]) -> None:
        if int(manifest.get("formatVersion", 0)) < 2:
            return
        if not segment.is_file():
            raise SegmentError(f"Missing sealed segment for {segment.name}")
        expected_bytes = manifest.get("compressedBytes")
        if not isinstance(expected_bytes, int) or segment.stat().st_size != expected_bytes:
            raise SegmentError(f"Compressed byte count mismatch for {segment.name}")
        checksum = manifest.get("sha256")
        if not isinstance(checksum, str) or stream_sha256(segment) != checksum:
            raise SegmentError(f"Checksum mismatch for {segment.name}")

    def _events(self, segment: pathlib.Path) -> Iterator[dict[str, Any]]:
        process = subprocess.Popen(["zstd", "--decompress", "--stdout", "--quiet", str(segment)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        assert process.stdout is not None
        try:
            for number, line in enumerate(process.stdout, start=1):
                if not line.strip():
                    continue
                try:
                    value = json.loads(line)
                except json.JSONDecodeError as error:
                    raise SegmentError(f"Invalid NDJSON in {segment.name} line {number}") from error
                if isinstance(value, dict):
                    yield value
        finally:
            if process.stdout:
                process.stdout.close()
            stderr_handle = process.stderr
            stderr = stderr_handle.read().strip() if stderr_handle else ""
            if stderr_handle:
                stderr_handle.close()
            code = process.wait()
            if code != 0:
                raise SegmentError(f"Unable to decompress {segment.name}: {stderr or code}")

    def ingest(self) -> dict[str, int]:
        result = {"processed": 0, "legacy": 0, "events": 0, "duplicates": 0}
        for segment, manifest, _manifest_path in self._manifest_segments():
            relative = str(segment.relative_to(self.config.raw_dir))
            checksum = str(manifest.get("sha256", ""))
            existing = self.conn.execute("SELECT sha256 FROM segments WHERE path = ?", (relative,)).fetchone()
            if existing and existing[0] == checksum:
                continue
            if int(manifest.get("formatVersion", 0)) < 2:
                # Deliberately acknowledge but do not interpret the legacy
                # corpus: the new longitudinal epoch starts at v2 deployment.
                self.conn.execute("INSERT OR REPLACE INTO segments(path, sha256, last_cursor, processed_at, outcome) VALUES(?, ?, ?, ?, 'legacy')", (relative, checksum, manifest.get("lastCursor"), utc_now().isoformat()))
                self.conn.commit()
                result["legacy"] += 1
                continue
            self._verify_segment(segment, manifest)
            try:
                self.conn.execute("BEGIN IMMEDIATE")
                for event in self._events(segment):
                    fingerprint = event_fingerprint(event)
                    if self.conn.execute("SELECT 1 FROM fingerprints WHERE fingerprint = ?", (fingerprint,)).fetchone():
                        result["duplicates"] += 1
                        continue
                    self.conn.execute("INSERT INTO fingerprints(fingerprint, seen_at) VALUES(?, ?)", (fingerprint, int(self.config.now())))
                    result["events"] += 1
                    self._apply_event(event, fingerprint)
                self.conn.execute("INSERT OR REPLACE INTO segments(path, sha256, last_cursor, processed_at, outcome) VALUES(?, ?, ?, ?, 'processed')", (relative, checksum, manifest.get("lastCursor"), utc_now().isoformat()))
                self.conn.execute("DELETE FROM fingerprints WHERE seen_at < ?", (int(self.config.now()) - FINGERPRINT_RETENTION_SECONDS,))
                self.conn.commit()
                result["processed"] += 1
            except Exception:
                self.conn.rollback()
                raise
        self.finalize_samples()
        if result["processed"]:
            self._set_meta("last_ingest_at", utc_now().isoformat())
            self.conn.commit()
        self.write_snapshot()
        return result

    def _apply_event(self, event: dict[str, Any], fingerprint: bytes) -> None:
        kind = event.get("kind")
        if kind == "commit":
            commit = event.get("commit")
            if not isinstance(commit, dict) or commit.get("collection") != "app.bsky.feed.post":
                return
            operation = commit.get("operation")
            if operation == "create" and isinstance(commit.get("record"), dict):
                self._observe_create(event, fingerprint)
            elif operation == "delete":
                self._delete_record(str(event.get("did", "")), str(commit.get("rkey", "")), "post delete")
            return
        if kind == "account":
            account = event.get("account") if isinstance(event.get("account"), dict) else {}
            if account.get("active") is False:
                self._delete_author(str(event.get("did") or account.get("did") or ""), "inactive account")

    def _observe_create(self, event: dict[str, Any], fingerprint: bytes) -> None:
        commit = event["commit"]
        record = commit["record"]
        observed = event_datetime(event)
        date = observed.date().isoformat()
        cursor = str(event.get("seq") or event.get("time_us") or "")
        minute = observed.strftime("%Y-%m-%dT%H:%M")
        language, declared_languages = normalized_languages(record)
        self.conn.execute("INSERT OR IGNORE INTO daily_minutes(date, minute) VALUES(?, ?)", (date, minute))
        self._bump_metrics("daily_metrics", (date,), post_total=1, first_cursor=cursor, last_cursor=cursor)
        self._bump_metrics("daily_language_metrics", (date, language), post_total=1)
        _kind, descriptions = image_descriptions(record)
        if not descriptions:
            return
        with_alt = [item for item in descriptions if item["alt"].strip()]
        counts = {
            "image_posts": 1,
            "images": len(descriptions),
            "images_with_alt": len(with_alt),
            "fully_described_image_posts": int(len(with_alt) == len(descriptions)),
            "alt_characters": sum(len(item["alt"].strip()) for item in with_alt),
            "alt_words": sum(count_words(item["alt"].strip()) for item in with_alt),
            "alt_descriptions": len(with_alt),
        }
        for item in with_alt:
            label = length_bin(len(item["alt"].strip()))
            if label:
                counts[f"len_{label}"] = counts.get(f"len_{label}", 0) + 1
        self._bump_metrics("daily_metrics", (date,), **counts)
        self._bump_metrics("daily_language_metrics", (date, language), **counts)
        if not self.sampling_allowed():
            return
        did, rkey = str(event.get("did", "")), str(commit.get("rkey", ""))
        if not did or not rkey:
            return
        record_pseudonym = self._pseudonym("record", f"{did}/{rkey}")
        author_pseudonym = self._pseudonym("author", f"{date[:7]}/{did}")
        for item in with_alt:
            sample_pseudonym = self._pseudonym("sample", f"{record_pseudonym}/{item['image_position']}")
            score = hmac.new(self.key, fingerprint + str(item["image_position"]).encode(), hashlib.sha256).digest()[:16]
            self._keep_candidate(date, score, {
                "record_pseudonym": record_pseudonym, "sample_pseudonym": sample_pseudonym,
                "author_pseudonym": author_pseudonym, "alt_text": item["alt"].strip(),
                "alt_characters": len(item["alt"].strip()), "alt_words": count_words(item["alt"].strip()),
                "declared_languages": json.dumps(declared_languages, ensure_ascii=False), **item,
            })

    def _bump_metrics(self, table: str, key: tuple[str, ...], **counts: Any) -> None:
        allowed = {"post_total", "image_posts", "images", "images_with_alt", "fully_described_image_posts", "alt_characters", "alt_words", "alt_descriptions", "len_1_25", "len_26_75", "len_76_150", "len_151_300", "len_301_plus"}
        increments = {name: int(value) for name, value in counts.items() if name in allowed and int(value)}
        if table == "daily_metrics":
            date = key[0]
            self.conn.execute("INSERT OR IGNORE INTO daily_metrics(date) VALUES(?)", (date,))
            if increments:
                clause = ", ".join(f"{name} = {name} + ?" for name in increments)
                self.conn.execute(f"UPDATE daily_metrics SET {clause}, first_cursor = COALESCE(first_cursor, ?), last_cursor = COALESCE(?, last_cursor) WHERE date = ?", (*increments.values(), counts.get("first_cursor"), counts.get("last_cursor"), date))
            elif counts.get("last_cursor"):
                self.conn.execute("UPDATE daily_metrics SET first_cursor = COALESCE(first_cursor, ?), last_cursor = ? WHERE date = ?", (counts.get("first_cursor"), counts.get("last_cursor"), date))
            return
        date, language = key
        self.conn.execute("INSERT OR IGNORE INTO daily_language_metrics(date, language) VALUES(?, ?)", (date, language))
        if increments:
            clause = ", ".join(f"{name} = {name} + ?" for name in increments)
            self.conn.execute(f"UPDATE daily_language_metrics SET {clause} WHERE date = ? AND language = ?", (*increments.values(), date, language))

    def _keep_candidate(self, date: str, score: bytes, value: dict[str, Any]) -> None:
        existing = self.conn.execute("SELECT score FROM candidates WHERE date = ? AND record_pseudonym = ? AND image_position = ?", (date, value["record_pseudonym"], value["image_position"])).fetchone()
        if existing:
            return
        worst = self.conn.execute("SELECT rowid, score FROM candidates WHERE date = ? ORDER BY score DESC LIMIT 1", (date,)).fetchone()
        count = self.conn.execute("SELECT COUNT(*) FROM candidates WHERE date = ?", (date,)).fetchone()[0]
        if count >= SAMPLE_CANDIDATES and worst and score >= worst["score"]:
            return
        if count >= SAMPLE_CANDIDATES and worst:
            self.conn.execute("DELETE FROM candidates WHERE rowid = ?", (worst["rowid"],))
        columns = ["date", "score", "record_pseudonym", "sample_pseudonym", "author_pseudonym", "alt_text", "alt_characters", "alt_words", "declared_languages", "image_position", "image_count", "mime_type", "width", "height", "orientation", "embed_kind"]
        self.conn.execute(f"INSERT INTO candidates({', '.join(columns)}) VALUES({', '.join('?' for _ in columns)})", (date, score, *(value[name] for name in columns[2:])))

    def _delete_record(self, did: str, rkey: str, reason: str) -> None:
        if not did or not rkey:
            return
        record = self._pseudonym("record", f"{did}/{rkey}")
        months = [row[0] for row in self.conn.execute("SELECT DISTINCT month FROM published_samples WHERE record_pseudonym = ? AND deleted = 0", (record,))]
        self.conn.execute("DELETE FROM candidates WHERE record_pseudonym = ?", (record,))
        self.conn.execute("UPDATE published_samples SET deleted = 1 WHERE record_pseudonym = ?", (record,))
        for month in months:
            self._mark_rewrite(month, reason)

    def _delete_author(self, did: str, reason: str) -> None:
        if not did:
            return
        months = [row[0] for row in self.conn.execute("SELECT DISTINCT month FROM published_samples")]
        for month in months:
            author = self._pseudonym("author", f"{month}/{did}")
            if self.conn.execute("SELECT 1 FROM published_samples WHERE month = ? AND author_pseudonym = ? AND deleted = 0", (month, author)).fetchone():
                self.conn.execute("UPDATE published_samples SET deleted = 1 WHERE month = ? AND author_pseudonym = ?", (month, author))
                self._mark_rewrite(month, reason)
        candidate_dates = [row[0] for row in self.conn.execute("SELECT DISTINCT date FROM candidates")]
        for date in candidate_dates:
            author = self._pseudonym("author", f"{date[:7]}/{did}")
            self.conn.execute("DELETE FROM candidates WHERE date = ? AND author_pseudonym = ?", (date, author))

    def _mark_rewrite(self, month: str, reason: str) -> None:
        self.conn.execute("INSERT INTO rewrites(month, reason, marked_at) VALUES(?, ?, ?) ON CONFLICT(month) DO UPDATE SET reason = excluded.reason, marked_at = excluded.marked_at", (month, reason, utc_now().isoformat()))

    def finalize_samples(self) -> None:
        # A UTC date is safe only after two complete correction days have
        # elapsed. On Sep 5, Sep 2 is the newest eligible date; using Sep 3
        # here could publish a late-Sep-3 description after barely 24 hours.
        cutoff = (utc_now().date() - dt.timedelta(days=3)).isoformat()
        dates = [row[0] for row in self.conn.execute("SELECT DISTINCT date FROM candidates WHERE date <= ? ORDER BY date", (cutoff,))]
        for date in dates:
            if self.conn.execute("SELECT 1 FROM finalized_dates WHERE date = ?", (date,)).fetchone():
                continue
            rows = self.conn.execute("SELECT * FROM candidates WHERE date = ? ORDER BY score ASC LIMIT ?", (date, PUBLISHED_SAMPLES)).fetchall()
            denominator = int(self.conn.execute("SELECT alt_descriptions FROM daily_metrics WHERE date = ?", (date,)).fetchone()[0] or 0)
            if rows:
                weight = denominator / len(rows)
                for row in rows:
                    values = dict(row)
                    self.conn.execute("""INSERT OR REPLACE INTO published_samples(
                      sample_pseudonym, date, month, record_pseudonym, author_pseudonym, alt_text,
                      alt_characters, alt_words, declared_languages, image_position, image_count, mime_type,
                      width, height, orientation, embed_kind, sampling_weight, deleted
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""", (
                      values["sample_pseudonym"], date, date[:7], values["record_pseudonym"], values["author_pseudonym"], values["alt_text"],
                      values["alt_characters"], values["alt_words"], values["declared_languages"], values["image_position"], values["image_count"],
                      values["mime_type"], values["width"], values["height"], values["orientation"], values["embed_kind"], weight,
                    ))
                self._mark_rewrite(date[:7], "new finalized sample")
            # Candidates not selected are disposable once the 48-hour correction window ends.
            self.conn.execute("DELETE FROM candidates WHERE date = ?", (date,))
            self.conn.execute("INSERT INTO finalized_dates(date, finalized_at) VALUES(?, ?)", (date, utc_now().isoformat()))
        self.conn.commit()

    def _coverage(self, date: str, observed_minutes: int) -> str:
        today = utc_now().date().isoformat()
        started = str(self._meta("collector_started_at", ""))[:10]
        if date >= today or date == started:
            return "partial"
        return "complete" if observed_minutes >= 1435 else "gapped"

    def _daily_rows(self, days: int | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM daily_metrics ORDER BY date"
        rows = [dict(row) for row in self.conn.execute(query)]
        if days is not None:
            rows = rows[-days:]
        sha = self.collector_sha()
        for row in rows:
            row["observed_minutes"] = int(self.conn.execute("SELECT COUNT(*) FROM daily_minutes WHERE date = ?", (row["date"],)).fetchone()[0])
            row["coverage_state"] = self._coverage(row["date"], row["observed_minutes"])
            row["image_alt_rate"] = row["images_with_alt"] / row["images"] if row["images"] else None
            row["fully_described_post_rate"] = row["fully_described_image_posts"] / row["image_posts"] if row["image_posts"] else None
            row["collector_git_sha"] = sha
            row["publication_timestamp"] = self._meta("last_ingest_at")
        return rows

    def _language_rows(self, days: int | None = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM daily_language_metrics ORDER BY date, language"
        rows = [dict(row) for row in self.conn.execute(query)]
        if days is not None:
            dates = {row["date"] for row in self._daily_rows(days)}
            rows = [row for row in rows if row["date"] in dates]
        for row in rows:
            row["image_alt_rate"] = row["images_with_alt"] / row["images"] if row["images"] else None
            row["fully_described_post_rate"] = row["fully_described_image_posts"] / row["image_posts"] if row["image_posts"] else None
        return rows

    def collector_sha(self) -> str:
        explicit = os.environ.get("OBSERVATORY_COLLECTOR_GIT_SHA")
        if explicit:
            return explicit
        try:
            return subprocess.check_output(["git", "-C", str(self.config.source_dir), "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
        except (OSError, subprocess.CalledProcessError):
            return "unknown"

    def write_snapshot(self) -> pathlib.Path:
        daily = self._daily_rows(1825)
        languages = self._language_rows(1825)
        try:
            sample_bins = json.loads(self._meta("published_sample_bins", "{}") or "{}")
        except json.JSONDecodeError:
            sample_bins = {}
        sample_bins = {
            f"len_{label}": int(sample_bins.get(f"len_{label}", 0))
            for _, _, label in LENGTH_BINS
        }
        first_complete = next((row["date"] for row in daily if row["coverage_state"] == "complete"), None)
        sampling_paused = self._meta("sampling_paused") == "1"
        sample_upload_paused = self._meta("sample_upload_paused") == "1"
        state = "paused" if sampling_paused or sample_upload_paused else "ready" if first_complete else "partial"
        updated = utc_now().isoformat()
        pause_reason = self._meta("sampling_pause_reason") if sampling_paused else self._meta("sample_upload_pause_reason") if sample_upload_paused else None
        snapshot = {
            "schemaVersion": 1,
            "generatedAt": updated,
            "dailyMetrics": daily,
            "dailyLanguageMetrics": languages,
            "sampleLengthDistribution": sample_bins,
            "status": {
                "state": state, "updatedAt": updated, "aggregateFreshnessAt": self._meta("last_ingest_at") if daily else None,
                "sampleFreshnessAt": self._meta("sample_published_at"), "firstCompleteDate": first_complete,
                "archiveFormatVersion": 2, "samplingPaused": sampling_paused,
                "sampleUploadPaused": sample_upload_paused,
                "message": pause_reason if pause_reason else ("UTC day is still partial; aggregates publish after the next complete day." if not first_complete else None),
            },
        }
        output = self.config.state_dir / "public-snapshot.json"
        json_dump_atomic(output, snapshot)
        return output

    def _dataset_card(self) -> str:
        return """---
license: other
configs:
  - config_name: daily_metrics
    default: true
    data_files: data/daily_metrics/*.parquet
  - config_name: daily_language_metrics
    data_files: data/daily_language_metrics/*.parquet
  - config_name: description_sample
    data_files: data/description_sample/*.parquet
---

# Bluesky Accessibility Observatory

This is a focused longitudinal observation of declared image descriptions in
public Bluesky post commits. It begins with archive-format v2 and does **not**
include the biased April 2026 snapshot corpus.

`daily_metrics` and `daily_language_metrics` are aggregate observations at post
creation time. `description_sample` is a deterministic, uniform bottom-k
sample of non-empty descriptions after a 48-hour correction window. It uses
keyed pseudonyms, not anonymous identifiers. Deletes and inactive-account
markers remove matching sample rows when observed; aggregate historical counts
remain creation-time observations.

Jetstream v1 is at-least-once and lacks sync markers, so this is responsive to
post/account deletion markers, not a perfect mirror of present network state.
Whitespace-only alt is missing; a multi-image post is fully described only when
every image has non-empty alt. Languages are declared primary BCP-47 tags or
`unknown`; no inferred language or English-only filtering is used.

Aggregate metrics and schema may be reused under CC0. Sampled descriptions
retain their authors' rights; this dataset does not claim a CC-BY license for
Bluesky user text. Do not use pseudonyms to profile people or join the data to
other identity-bearing sources.

Sampling weight is `eligible non-empty descriptions that UTC day / published
descriptions that UTC day`; at most 2,000 rows per day are published. See
`docs/METHODOLOGY.md`, `docs/DATA_DICTIONARY.md`, `docs/CHANGELOG.md`, and
`manifest.json` for coverage, fields, freshness, checksums, and loading
examples.
"""

    @staticmethod
    def _docs() -> dict[str, str]:
        return {
            "docs/METHODOLOGY.md": """# Methodology\n\nThe collector reads only checksum-verified archive-format-v2 Jetstream segments. It counts every observed `app.bsky.feed.post` create, then examines direct image embeds and `recordWithMedia` image embeds. Blank or whitespace-only descriptions are missing. A post is fully described only if every image has non-empty alt. UTC date is the Jetstream event timestamp. Deletion/account markers update sampled rows; aggregate daily metrics are not retroactively redefined.\n\nThe stream is at-least-once. A seven-day keyed 128-bit fingerprint ledger makes inclusive replay idempotent. Segment failure never advances the checkpoint. Jetstream v1 has no sync marker, so coverage reports observed minutes and marks partial/gapped days honestly.\n\nFor each day, all non-empty image descriptions compete by a keyed 128-bit score. The lowest 5,000 are retained during the 48-hour correction window; the lowest 2,000 (or fewer) are published. The sampling weight is eligible descriptions divided by rows published.\n""",
            "docs/DATA_DICTIONARY.md": """# Data dictionary\n\n`daily_metrics`: UTC date, coverage state, observed minutes, cursor bounds, total posts, image posts/images, images with alt, fully described image posts, alt character/word totals, fixed character-length bins, rates, collector revision, and publication timestamp.\n\n`daily_language_metrics`: the relevant daily denominators/counts by normalized primary declared BCP-47 language or `unknown`.\n\n`description_sample`: sample/record pseudonyms, month-scoped author pseudonym, UTC date, description, character/word length, declared languages, image position/count, MIME type, dimensions/orientation, embed kind, and sampling weight. It excludes post text, image bytes/URLs, CIDs, raw records, DIDs, and handles.\n""",
            "docs/CHANGELOG.md": """# Changelog\n\n## 2026-09-02 — Epoch 1\n\nStarted a clean archive-format-v2 observatory epoch. The April 2026 targeted-account corpus is frozen separately and is not part of this series.\n""",
            "docs/LOADING.md": """# Loading\n\n```python\nfrom datasets import load_dataset\ndaily = load_dataset('lukeslp/bluesky-alt-text-observatory', 'daily_metrics')\nsample = load_dataset('lukeslp/bluesky-alt-text-observatory', 'description_sample')\n```\n\nUse the default `daily_metrics` configuration for aggregate trends. Description rows have an additional 48-hour publication delay and must be treated as samples, not a census.\n""",
        }

    def _parquet_rows(self, config: str, month: str) -> list[dict[str, Any]]:
        if config == "daily_metrics":
            return [row for row in self._daily_rows() if row["date"].startswith(month) and row["coverage_state"] == "complete"]
        if config == "daily_language_metrics":
            valid_dates = {row["date"] for row in self._daily_rows() if row["date"].startswith(month) and row["coverage_state"] == "complete"}
            return [row for row in self._language_rows() if row["date"] in valid_dates]
        rows = []
        for item in self.conn.execute("SELECT * FROM published_samples WHERE month = ? AND deleted = 0 ORDER BY sample_pseudonym", (month,)):
            row = dict(item)
            row.pop("deleted", None)
            row["declared_languages"] = json.loads(row["declared_languages"])
            rows.append(row)
        return rows

    @staticmethod
    def _parquet_schema(config: str) -> Any:
        import pyarrow as pa

        string = pa.string()
        integer = pa.int64()
        floating = pa.float64()
        schemas = {
            "daily_metrics": pa.schema([
                ("date", string), ("coverage_state", string), ("observed_minutes", integer),
                ("first_cursor", string), ("last_cursor", string),
                *((field, integer) for field in COUNT_FIELDS),
                ("image_alt_rate", floating), ("fully_described_post_rate", floating),
                ("collector_git_sha", string), ("publication_timestamp", string),
            ]),
            "daily_language_metrics": pa.schema([
                ("date", string), ("language", string),
                *((field, integer) for field in COUNT_FIELDS),
                ("image_alt_rate", floating), ("fully_described_post_rate", floating),
            ]),
            "description_sample": pa.schema([
                ("sample_pseudonym", string), ("date", string), ("month", string),
                ("record_pseudonym", string), ("author_pseudonym", string),
                ("alt_text", string), ("alt_characters", integer), ("alt_words", integer),
                ("declared_languages", pa.list_(string)), ("image_position", integer),
                ("image_count", integer), ("mime_type", string), ("width", integer),
                ("height", integer), ("orientation", string), ("embed_kind", string),
                ("sampling_weight", floating),
            ]),
        }
        return schemas[config]

    def _write_parquet(self, destination: pathlib.Path, rows: list[dict[str, Any]], config: str) -> int:
        import pyarrow as pa
        import pyarrow.parquet as pq
        if not rows:
            return 0
        keys = set().union(*(row.keys() for row in rows))
        allowed = set(EXPORT_FIELDS[config])
        if keys != allowed:
            raise RuntimeError(
                f"export allowlist violation for {config}: "
                f"unexpected={sorted(keys - allowed)} missing={sorted(allowed - keys)}"
            )
        schema = self._parquet_schema(config)
        with pq.ParquetWriter(destination, schema, compression="zstd") as writer:
            for start in range(0, len(rows), 10_000):
                writer.write_table(pa.Table.from_pylist(rows[start:start + 10_000], schema=schema))
        return len(rows)

    @staticmethod
    def _current_sample_bins(conn: sqlite3.Connection) -> dict[str, int]:
        result = {f"len_{label}": 0 for _, _, label in LENGTH_BINS}
        for row in conn.execute("SELECT alt_characters FROM published_samples WHERE deleted = 0"):
            label = length_bin(int(row[0]))
            if label:
                result[f"len_{label}"] += 1
        return result

    def _remote_files(self, api: Any) -> dict[str, int]:
        return {
            str(getattr(item, "path", "")): int(getattr(item, "size", 0) or 0)
            for item in api.list_repo_tree(
                self.config.repo_id, repo_type="dataset", recursive=True, expand=True
            )
        }

    def publish(self, dry_run: bool = False) -> dict[str, Any]:
        """Upload changed monthly shards only; a no-op creates no HF commit."""
        self.finalize_samples()
        snapshot = self.write_snapshot()
        if dry_run:
            return {"dryRun": True, "snapshot": str(snapshot)}
        from huggingface_hub import CommitOperationAdd, CommitOperationDelete, HfApi
        api = HfApi()
        api.create_repo(self.config.repo_id, repo_type="dataset", private=False, exist_ok=True)
        remote_files = self._remote_files(api)
        remote_size = sum(remote_files.values())
        months = sorted({row[0][:7] for row in self.conn.execute("SELECT date FROM daily_metrics")} | {row[0] for row in self.conn.execute("SELECT DISTINCT month FROM published_samples")})
        operations: list[Any] = []
        staged: list[pathlib.Path] = []
        manifest_files: list[dict[str, Any]] = []
        sample_upload_pause_triggered = False
        try:
            for month in months:
                for config in ("daily_metrics", "daily_language_metrics", "description_sample"):
                    rows = self._parquet_rows(config, month)
                    path_in_repo = f"data/{config}/{month}.parquet"
                    previous = self.conn.execute("SELECT sha256 FROM published_files WHERE path = ?", (path_in_repo,)).fetchone()
                    if not rows:
                        if previous:
                            operations.append(CommitOperationDelete(path_in_repo=path_in_repo))
                            self.conn.execute("DELETE FROM published_files WHERE path = ?", (path_in_repo,))
                            remote_size -= remote_files.get(path_in_repo, 0)
                            manifest_files.append({"path": path_in_repo, "rows": 0, "sha256": None, "deleted": True})
                        continue
                    destination = temporary_path(suffix=".parquet")
                    staged.append(destination)
                    row_count = self._write_parquet(destination, rows, config)
                    checksum = stream_sha256(destination)
                    if previous and previous[0] == checksum:
                        continue
                    replacement_bytes = remote_files.get(path_in_repo, 0)
                    if config == "description_sample" and not previous and (
                        self._meta("sample_upload_paused") == "1"
                        or remote_size - replacement_bytes + destination.stat().st_size > self.config.sample_repo_cap_bytes
                    ):
                        self._set_meta("sample_upload_paused", "1")
                        self._set_meta("sample_upload_pause_reason", "Hugging Face repository ceiling reached; aggregates and local sampling continue")
                        sample_upload_pause_triggered = True
                        continue
                    operations.append(CommitOperationAdd(path_in_repo=path_in_repo, path_or_fileobj=str(destination)))
                    manifest_files.append({"path": path_in_repo, "rows": row_count, "sha256": checksum})
                    self.conn.execute("INSERT INTO published_files(path, sha256, row_count, published_at) VALUES(?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET sha256=excluded.sha256, row_count=excluded.row_count, published_at=excluded.published_at", (path_in_repo, checksum, row_count, utc_now().isoformat()))
                    remote_size = remote_size - replacement_bytes + destination.stat().st_size
            docs = {"README.md": self._dataset_card(), **self._docs()}
            aggregate_changed = any(item["path"].startswith("data/daily_") for item in manifest_files)
            sample_changed = any(item["path"].startswith("data/description_sample/") for item in manifest_files)
            commit_timestamp = utc_now().isoformat()
            cursor_bounds = [{"date": row["date"], "firstCursor": row["first_cursor"], "lastCursor": row["last_cursor"]} for row in self._daily_rows()]
            published_data_files = [dict(row) for row in self.conn.execute("SELECT path, row_count AS rows, sha256 FROM published_files WHERE path LIKE 'data/%' ORDER BY path")]
            manifest_content = {
                "schemaVersion": 1, "collectorGitSha": self.collector_sha(),
                "files": published_data_files, "cursorBounds": cursor_bounds,
                "aggregateFreshnessAt": commit_timestamp if aggregate_changed else self._meta("aggregate_published_at"),
                "sampleFreshnessAt": commit_timestamp if sample_changed else self._meta("sample_published_at"),
            }
            manifest_signature = hashlib.sha256(
                json.dumps(manifest_content, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest()
            manifest_generated_at = (
                self._meta("manifest_generated_at")
                if self._meta("manifest_content_sha256") == manifest_signature
                else commit_timestamp
            ) or commit_timestamp
            manifest = {**manifest_content, "generatedAt": manifest_generated_at}
            docs["manifest.json"] = json.dumps(manifest, sort_keys=True, indent=2) + "\n"
            for path_in_repo, body in docs.items():
                destination = temporary_path(suffix=".json" if path_in_repo.endswith(".json") else ".md")
                destination.write_text(body, encoding="utf-8")
                staged.append(destination)
                checksum = stream_sha256(destination)
                previous = self.conn.execute("SELECT sha256 FROM published_files WHERE path = ?", (path_in_repo,)).fetchone()
                if previous and previous[0] == checksum:
                    continue
                operations.append(CommitOperationAdd(path_in_repo=path_in_repo, path_or_fileobj=str(destination)))
                self.conn.execute("INSERT INTO published_files(path, sha256, row_count, published_at) VALUES(?, ?, 0, ?) ON CONFLICT(path) DO UPDATE SET sha256=excluded.sha256, published_at=excluded.published_at", (path_in_repo, checksum, utc_now().isoformat()))
            if not operations:
                if sample_upload_pause_triggered:
                    self.conn.commit()
                    self.write_snapshot()
                else:
                    self.conn.rollback()
                return {"committed": False, "reason": "no changes"}
            api.create_commit(self.config.repo_id, repo_type="dataset", operations=operations, commit_message="Update accessibility observatory shards")
            self.conn.execute("DELETE FROM rewrites")
            if aggregate_changed:
                self._set_meta("aggregate_published_at", commit_timestamp)
            if sample_changed:
                self._set_meta("sample_published_at", commit_timestamp)
                self._set_meta("published_sample_bins", json.dumps(self._current_sample_bins(self.conn), sort_keys=True))
            self._set_meta("manifest_content_sha256", manifest_signature)
            self._set_meta("manifest_generated_at", manifest_generated_at)
            self.conn.commit()
            self.write_snapshot()
            return {"committed": True, "operations": len(operations)}
        except Exception:
            self.conn.rollback()
            raise
        finally:
            for path in staged:
                path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("ingest", "publish", "run"))
    parser.add_argument("--dry-run", action="store_true", help="Build snapshot only; do not call Hugging Face")
    args = parser.parse_args()
    observatory = Observatory(Config.from_env())
    try:
        if args.command in ("ingest", "run"):
            print(json.dumps(observatory.ingest(), sort_keys=True))
        if args.command in ("publish", "run"):
            print(json.dumps(observatory.publish(dry_run=args.dry_run), sort_keys=True))
    finally:
        observatory.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
