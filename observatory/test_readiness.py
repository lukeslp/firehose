from __future__ import annotations

import datetime as dt
import hashlib
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import publisher
import readiness


class FakeDatasetInfo:
    sha = "dataset-revision-1"


class FakeApi:
    def dataset_info(self, _repo_id: str) -> FakeDatasetInfo:
        return FakeDatasetInfo()


class ReadinessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.raw = self.root / "raw"
        self.raw.mkdir()
        self.state = self.root / "state"
        self.remote = self.root / "remote"
        self.remote.mkdir()
        self.observatory = publisher.Observatory(
            publisher.Config(raw_dir=self.raw, state_dir=self.state)
        )
        self.observatory._set_meta("collector_started_at", "2026-09-02T20:00:00+00:00")
        self.observatory.conn.execute(
            """
            INSERT INTO daily_metrics(
              date, post_total, image_posts, images, images_with_alt,
              fully_described_image_posts, alt_characters, alt_words,
              alt_descriptions, len_1_25, len_26_75, len_76_150,
              len_151_300, len_301_plus, first_cursor, last_cursor
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-09-03",
                100,
                20,
                25,
                15,
                10,
                900,
                150,
                15,
                2,
                3,
                4,
                5,
                1,
                "first",
                "last",
            ),
        )
        self.observatory.conn.executemany(
            "INSERT INTO daily_minutes(date, minute) VALUES(?, ?)",
            (("2026-09-03", f"minute-{index:04d}") for index in range(1435)),
        )
        self.observatory.conn.execute(
            """
            INSERT INTO daily_language_metrics(
              date, language, post_total, image_posts, images, images_with_alt,
              fully_described_image_posts, alt_characters, alt_words,
              alt_descriptions, len_1_25, len_26_75, len_76_150,
              len_151_300, len_301_plus
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("2026-09-03", "en", 100, 20, 25, 15, 10, 900, 150, 15, 2, 3, 4, 5, 1),
        )
        self.observatory.conn.commit()
        (self.raw / "segment.ndjson.zst").write_bytes(b"sealed")
        (self.raw / "segment.manifest.json").write_text("{}\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.observatory.close()
        self.temp.cleanup()

    def _write_remote(self, *, early_sample: bool = False) -> dict[str, pathlib.Path]:
        with mock.patch.object(
            publisher,
            "utc_now",
            return_value=dt.datetime(2026, 9, 4, 3, 15, tzinfo=dt.UTC),
        ):
            daily_rows = self.observatory._daily_rows()
            language_rows = self.observatory._language_rows()
        files: dict[str, pathlib.Path] = {}
        configured_rows: list[tuple[str, list[dict[str, object]]]] = [
            ("daily_metrics", daily_rows),
            ("daily_language_metrics", language_rows),
        ]
        if early_sample:
            configured_rows.append(
                (
                    "description_sample",
                    [
                        {
                            "sample_pseudonym": "sample_1",
                            "date": "2026-09-03",
                            "month": "2026-09",
                            "record_pseudonym": "record_1",
                            "author_pseudonym": "author_1",
                            "alt_text": "Withheld description",
                            "alt_characters": 20,
                            "alt_words": 2,
                            "declared_languages": ["en"],
                            "image_position": 1,
                            "image_count": 1,
                            "mime_type": "image/jpeg",
                            "width": 100,
                            "height": 100,
                            "orientation": "square",
                            "embed_kind": "images",
                            "sampling_weight": 1.0,
                        }
                    ],
                )
            )

        manifest_files: list[dict[str, object]] = []
        for config, rows in configured_rows:
            relative = f"data/{config}/2026-09.parquet"
            destination = self.remote / f"{config}.parquet"
            count = self.observatory._write_parquet(destination, rows, config)
            checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
            files[relative] = destination
            manifest_files.append({"path": relative, "rows": count, "sha256": checksum})
            self.observatory.conn.execute(
                "INSERT INTO published_files(path, sha256, row_count, published_at) "
                "VALUES(?, ?, ?, ?)",
                (relative, checksum, count, "2026-09-04T03:15:00+00:00"),
            )
        self.observatory.conn.commit()
        manifest = {
            "schemaVersion": 1,
            "collectorGitSha": "collector-1",
            "generatedAt": "2026-09-04T03:15:00+00:00",
            "aggregateFreshnessAt": "2026-09-04T03:15:00+00:00",
            "sampleFreshnessAt": None,
            "cursorBounds": [
                {"date": "2026-09-03", "firstCursor": "first", "lastCursor": "last"}
            ],
            "files": manifest_files,
        }
        manifest_path = self.remote / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        files["manifest.json"] = manifest_path
        return files

    def _verifier(
        self, files: dict[str, pathlib.Path]
    ) -> readiness.PublicationVerifier:
        def download(
            _repo_id: str,
            *,
            filename: str,
            repo_type: str,
            revision: str,
            local_dir: str,
        ) -> str:
            self.assertEqual(repo_type, "dataset")
            self.assertEqual(revision, "dataset-revision-1")
            self.assertTrue(local_dir)
            return str(files[filename])

        return readiness.PublicationVerifier(
            readiness.Config(
                raw_dir=self.raw,
                state_dir=self.state,
                repo_id="lukeslp/test-observatory",
                public_urls=("https://example.test/observatory",),
            ),
            api=FakeApi(),
            downloader=download,
            probe=lambda url: {
                "url": url,
                "status": 200,
                "finalUrl": url,
                "contentType": "text/html",
            },
        )

    @unittest.skipUnless(importlib.util.find_spec("pyarrow"), "PyArrow required")
    def test_verifies_remote_schema_counts_checksums_routes_and_local_archive(
        self,
    ) -> None:
        files = self._write_remote()
        verifier = self._verifier(files)

        with mock.patch.object(
            readiness,
            "utc_now",
            return_value=dt.datetime(2026, 9, 4, 4, 0, tzinfo=dt.UTC),
        ):
            result = verifier.verify(require_complete=True)

        self.assertTrue(result["ok"])
        self.assertEqual(result["datasetRevision"], "dataset-revision-1")
        self.assertEqual(result["completeDates"], ["2026-09-03"])
        self.assertEqual(result["sampleRows"], 0)
        self.assertEqual(result["archive"]["segments"], 1)
        self.assertEqual(result["archive"]["manifests"], 1)
        self.assertEqual(len(result["dataFiles"]), 2)
        self.assertTrue((self.state / "readiness" / "latest.json").is_file())

    @unittest.skipUnless(importlib.util.find_spec("pyarrow"), "PyArrow required")
    def test_rejects_a_description_before_two_complete_correction_days(self) -> None:
        files = self._write_remote(early_sample=True)
        verifier = self._verifier(files)

        with (
            mock.patch.object(
                readiness,
                "utc_now",
                return_value=dt.datetime(2026, 9, 5, 4, 0, tzinfo=dt.UTC),
            ),
            self.assertRaisesRegex(
                readiness.VerificationError,
                "correction window",
            ),
        ):
            verifier.verify(require_complete=True)


if __name__ == "__main__":
    unittest.main()
