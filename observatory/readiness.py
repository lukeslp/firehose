#!/usr/bin/env python3
"""Verify one published observatory revision without exposing sampled content."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import sqlite3
import sys
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.request import Request, urlopen

import publisher

DEFAULT_PUBLIC_URLS = (
    "https://dr.eamer.dev/bluesky/firehose/accessibility/",
    "https://dr.eamer.dev/downloads/bluesky-alt-text/",
)
STABLE_DAILY_FIELDS = tuple(
    field
    for field in publisher.EXPORT_FIELDS["daily_metrics"]
    if field not in {"collector_git_sha", "publication_timestamp"}
)


class VerificationError(RuntimeError):
    """The public revision does not match its local publication ledger."""


@dataclass(frozen=True)
class Config:
    raw_dir: pathlib.Path
    state_dir: pathlib.Path
    repo_id: str
    public_urls: tuple[str, ...] = DEFAULT_PUBLIC_URLS

    @classmethod
    def from_env(cls) -> Config:
        urls = os.environ.get("OBSERVATORY_PUBLIC_URLS")
        return cls(
            raw_dir=pathlib.Path(
                os.environ.get("RAW_ARCHIVE_DIR", "/home/coolhand/firehose-data/raw")
            ),
            state_dir=pathlib.Path(
                os.environ.get(
                    "OBSERVATORY_STATE_DIR",
                    "/home/coolhand/firehose-data/observatory",
                )
            ),
            repo_id=os.environ.get(
                "OBSERVATORY_HF_REPO",
                "lukeslp/bluesky-alt-text-observatory",
            ),
            public_urls=(
                tuple(item.strip() for item in urls.split(",") if item.strip())
                if urls
                else DEFAULT_PUBLIC_URLS
            ),
        )


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def probe_url(url: str) -> dict[str, Any]:
    request = Request(url, headers={"User-Agent": "firehose-publication-verifier/1"})
    with urlopen(request, timeout=20) as response:
        response.read(1024)
        status = int(response.status)
        if not 200 <= status < 300:
            raise VerificationError(f"public route returned HTTP {status}: {url}")
        return {
            "url": url,
            "status": status,
            "finalUrl": response.geturl(),
            "contentType": response.headers.get_content_type(),
        }


class PublicationVerifier:
    def __init__(
        self,
        config: Config,
        *,
        api: Any | None = None,
        downloader: Callable[..., str] | None = None,
        probe: Callable[[str], dict[str, Any]] = probe_url,
    ) -> None:
        self.config = config
        self._api = api
        self._downloader = downloader
        self._probe = probe

    def _database(self) -> sqlite3.Connection:
        path = self.config.state_dir / "state.sqlite3"
        if not path.is_file():
            raise VerificationError("observatory state database is missing")
        connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _meta(connection: sqlite3.Connection, key: str) -> str | None:
        row = connection.execute(
            "SELECT value FROM meta WHERE key = ?", (key,)
        ).fetchone()
        return str(row[0]) if row else None

    def _daily_rows(self, connection: sqlite3.Connection) -> list[dict[str, Any]]:
        today = utc_now().date().isoformat()
        started = (self._meta(connection, "collector_started_at") or "")[:10]
        rows = [dict(row) for row in connection.execute("SELECT * FROM daily_metrics")]
        for row in rows:
            observed_minutes = int(
                connection.execute(
                    "SELECT COUNT(*) FROM daily_minutes WHERE date = ?",
                    (row["date"],),
                ).fetchone()[0]
            )
            if row["date"] >= today or row["date"] == started:
                coverage = "partial"
            else:
                coverage = "complete" if observed_minutes >= 1435 else "gapped"
            row["observed_minutes"] = observed_minutes
            row["coverage_state"] = coverage
            row["image_alt_rate"] = (
                row["images_with_alt"] / row["images"] if row["images"] else None
            )
            row["fully_described_post_rate"] = (
                row["fully_described_image_posts"] / row["image_posts"]
                if row["image_posts"]
                else None
            )
        return sorted(rows, key=lambda row: row["date"])

    @staticmethod
    def _language_rows(
        connection: sqlite3.Connection,
        dates: set[str],
    ) -> list[dict[str, Any]]:
        rows = [
            dict(row)
            for row in connection.execute("SELECT * FROM daily_language_metrics")
        ]
        result: list[dict[str, Any]] = []
        for row in rows:
            if row["date"] not in dates:
                continue
            row["image_alt_rate"] = (
                row["images_with_alt"] / row["images"] if row["images"] else None
            )
            row["fully_described_post_rate"] = (
                row["fully_described_image_posts"] / row["image_posts"]
                if row["image_posts"]
                else None
            )
            result.append(row)
        return sorted(result, key=lambda row: (row["date"], row["language"]))

    @staticmethod
    def _manifest_files(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
        if manifest.get("schemaVersion") != 1 or not isinstance(
            manifest.get("files"), list
        ):
            raise VerificationError("publication manifest schema is invalid")
        result: dict[str, dict[str, Any]] = {}
        for item in manifest["files"]:
            if not isinstance(item, dict):
                raise VerificationError(
                    "publication manifest contains an invalid file entry"
                )
            path = item.get("path")
            checksum = item.get("sha256")
            rows = item.get("rows")
            parts = pathlib.PurePosixPath(path).parts if isinstance(path, str) else ()
            if (
                len(parts) != 3
                or parts[0] != "data"
                or parts[1] not in publisher.EXPORT_FIELDS
                or not parts[2].endswith(".parquet")
                or not isinstance(checksum, str)
                or len(checksum) != 64
                or any(character not in "0123456789abcdef" for character in checksum)
                or not isinstance(rows, int)
                or rows < 0
                or path in result
            ):
                raise VerificationError(
                    "publication manifest contains an invalid file entry"
                )
            result[path] = item
        return result

    @staticmethod
    def _assert_rows(
        label: str,
        local_rows: list[dict[str, Any]],
        remote_rows: list[dict[str, Any]],
        fields: tuple[str, ...],
        key_fields: tuple[str, ...],
    ) -> None:
        def normalized(
            rows: list[dict[str, Any]],
        ) -> dict[tuple[Any, ...], tuple[Any, ...]]:
            result: dict[tuple[Any, ...], tuple[Any, ...]] = {}
            for row in rows:
                key = tuple(row[field] for field in key_fields)
                if key in result:
                    raise VerificationError(f"{label} contains duplicate keys")
                result[key] = tuple(row[field] for field in fields)
            return result

        if normalized(local_rows) != normalized(remote_rows):
            raise VerificationError(f"{label} rows do not match local aggregates")

    def _write_report(self, report: dict[str, Any]) -> None:
        report_dir = self.config.state_dir / "readiness"
        timestamp = utc_now().strftime("%Y-%m-%dT%H%M%SZ")
        publisher.json_dump_atomic(report_dir / f"{timestamp}.json", report)
        publisher.json_dump_atomic(report_dir / "latest.json", report)

    def verify(self, *, require_complete: bool = False) -> dict[str, Any]:
        try:
            from huggingface_hub import HfApi, hf_hub_download
        except ImportError as error:
            raise VerificationError("Hugging Face client is unavailable") from error

        api = self._api or HfApi()
        downloader = self._downloader or hf_hub_download
        connection = self._database()
        try:
            daily = self._daily_rows(connection)
            complete = [row for row in daily if row["coverage_state"] == "complete"]
            if require_complete and not complete:
                raise VerificationError(
                    "no complete UTC date is ready for verification"
                )
            target_months = {row["date"][:7] for row in complete[-1:]}
            local_files = {
                row["path"]: {"sha256": row["sha256"], "rows": row["row_count"]}
                for row in connection.execute(
                    "SELECT path, sha256, row_count FROM published_files "
                    "WHERE path LIKE 'data/%'"
                )
            }
            info = api.dataset_info(self.config.repo_id)
            revision = str(getattr(info, "sha", ""))
            if not revision:
                raise VerificationError("dataset revision is unavailable")

            with tempfile.TemporaryDirectory(
                prefix="observatory-readiness-"
            ) as download_dir:
                manifest_path = pathlib.Path(
                    downloader(
                        self.config.repo_id,
                        filename="manifest.json",
                        repo_type="dataset",
                        revision=revision,
                        local_dir=download_dir,
                    )
                )
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest_files = self._manifest_files(manifest)
                manifest_ledger = {
                    path: {"sha256": item["sha256"], "rows": item["rows"]}
                    for path, item in manifest_files.items()
                }
                if local_files != manifest_ledger:
                    raise VerificationError(
                        "remote manifest does not match the local publication ledger"
                    )

                selected_paths = [
                    path
                    for path in sorted(manifest_files)
                    if pathlib.PurePosixPath(path).stem in target_months
                ]
                tables: dict[str, list[dict[str, Any]]] = {
                    config: [] for config in publisher.EXPORT_FIELDS
                }
                verified_files: list[dict[str, Any]] = []
                import pyarrow.parquet as pq

                for path in selected_paths:
                    item = manifest_files[path]
                    local_path = pathlib.Path(
                        downloader(
                            self.config.repo_id,
                            filename=path,
                            repo_type="dataset",
                            revision=revision,
                            local_dir=download_dir,
                        )
                    )
                    if publisher.stream_sha256(local_path) != item["sha256"]:
                        raise VerificationError(f"published checksum mismatch: {path}")
                    config_name = pathlib.PurePosixPath(path).parts[1]
                    parquet = pq.ParquetFile(local_path)
                    if (
                        tuple(parquet.schema_arrow.names)
                        != publisher.EXPORT_FIELDS[config_name]
                    ):
                        raise VerificationError(
                            f"published Parquet schema mismatch: {path}"
                        )
                    if parquet.metadata.num_rows != item["rows"]:
                        raise VerificationError(
                            f"published Parquet row count mismatch: {path}"
                        )
                    tables[config_name].extend(parquet.read().to_pylist())
                    verified_files.append(
                        {"path": path, "rows": item["rows"], "sha256": item["sha256"]}
                    )

            target_complete = [
                row for row in complete if row["date"][:7] in target_months
            ]
            self._assert_rows(
                "daily metrics",
                target_complete,
                tables["daily_metrics"],
                STABLE_DAILY_FIELDS,
                ("date",),
            )
            complete_dates = {row["date"] for row in target_complete}
            self._assert_rows(
                "daily language metrics",
                self._language_rows(connection, complete_dates),
                tables["daily_language_metrics"],
                publisher.EXPORT_FIELDS["daily_language_metrics"],
                ("date", "language"),
            )
            sample_rows = tables["description_sample"]
            newest_allowed_sample_date = (
                utc_now().date() - dt.timedelta(days=3)
            ).isoformat()
            if any(
                str(row["date"]) > newest_allowed_sample_date for row in sample_rows
            ):
                raise VerificationError(
                    "published description sample violates the correction window"
                )

            segments = list(self.config.raw_dir.rglob("*.ndjson.zst"))
            manifests = list(self.config.raw_dir.rglob("*.manifest.json"))
            routes = [self._probe(url) for url in self.config.public_urls]
            result = {
                "ok": True,
                "verifiedAt": utc_now().isoformat(),
                "datasetRevision": revision,
                "manifestFiles": len(manifest_files),
                "completeDates": [row["date"] for row in complete],
                "latestCompleteDate": complete[-1]["date"] if complete else None,
                "dataFiles": verified_files,
                "sampleRows": len(sample_rows),
                "archive": {
                    "segments": len(segments),
                    "manifests": len(manifests),
                    "sealedBytes": sum(path.stat().st_size for path in segments),
                },
                "publicRoutes": routes,
            }
            self._write_report(result)
            return result
        finally:
            connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--require-complete",
        action="store_true",
        help="Fail until at least one complete UTC date is published",
    )
    args = parser.parse_args()
    verifier = PublicationVerifier(Config.from_env())
    try:
        result = verifier.verify(require_complete=args.require_complete)
    except (OSError, ValueError, VerificationError) as error:
        failure = {
            "ok": False,
            "verifiedAt": utc_now().isoformat(),
            "error": str(error),
        }
        verifier._write_report(failure)
        print(json.dumps(failure, sort_keys=True), file=sys.stderr)
        return 1
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
