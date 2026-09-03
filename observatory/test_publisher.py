from __future__ import annotations

import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from datetime import UTC, datetime
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import publisher


def create_event(cursor: str, rkey: str, alt: str | list[str], *, wrapped: bool = False, langs: list[str] | None = None) -> dict:
    alternatives = [alt] if isinstance(alt, str) else alt
    images = [{"alt": value, "image": {"mimeType": "image/jpeg"}, "aspectRatio": {"width": 800, "height": 600}} for value in alternatives]
    embed = {"$type": "app.bsky.embed.images", "images": images}
    if wrapped:
        embed = {"$type": "app.bsky.embed.recordWithMedia", "record": {"uri": "at://did:plc:q/app.bsky.feed.post/q"}, "media": embed}
    return {"kind": "commit", "time_us": cursor, "did": "did:plc:author", "commit": {"collection": "app.bsky.feed.post", "operation": "create", "rkey": rkey, "cid": f"cid-{rkey}", "record": {"createdAt": "2026-09-02T00:00:00Z", "langs": langs if langs is not None else ["EN_us"], "embed": embed}}}


def write_segment(root: pathlib.Path, name: str, events: list[dict], *, corrupt: bool = False) -> None:
    plain = root / f"{name}.ndjson"
    plain.write_text("".join(json.dumps(event) + "\n" for event in events), encoding="utf-8")
    segment = root / f"{name}.ndjson.zst"
    subprocess.run(["zstd", "-3", "--quiet", "-f", str(plain), "-o", str(segment)], check=True)
    plain.unlink()
    if corrupt:
        segment.write_bytes(b"corrupt")
    manifest = {"formatVersion": 2, "eventKinds": ["commit", "account", "identity"], "compressedBytes": segment.stat().st_size, "sha256": hashlib.sha256(segment.read_bytes()).hexdigest(), "lastCursor": events[-1].get("time_us") if events else ""}
    (root / f"{name}.manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


class PublisherTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.temp.name)
        self.raw = root / "raw"
        self.raw.mkdir()
        self.state = root / "state"

    def tearDown(self) -> None:
        self.temp.cleanup()

    def open(self) -> publisher.Observatory:
        return publisher.Observatory(publisher.Config(raw_dir=self.raw, state_dir=self.state))

    def test_direct_and_record_with_media_are_exact_and_replay_is_idempotent(self) -> None:
        first = create_event("1788307200000000", "one", "A clear diagram")
        second = create_event("1788307201000000", "two", ["  ", "A chart"], wrapped=True)
        write_segment(self.raw, "a", [first, second])
        write_segment(self.raw, "b", [first])
        observatory = self.open()
        try:
            result = observatory.ingest()
            self.assertEqual(result["duplicates"], 1)
            row = observatory.conn.execute("SELECT * FROM daily_metrics").fetchone()
            self.assertEqual(row["post_total"], 2)
            self.assertEqual(row["images"], 3)
            self.assertEqual(row["images_with_alt"], 2)
            self.assertEqual(row["fully_described_image_posts"], 1)
            language = observatory.conn.execute("SELECT language, images_with_alt FROM daily_language_metrics").fetchone()
            self.assertEqual((language["language"], language["images_with_alt"]), ("en", 2))
            snapshot = json.loads((self.state / "public-snapshot.json").read_text())
            self.assertNotIn("did", json.dumps(snapshot))
            again = observatory.ingest()
            self.assertEqual(again["processed"], 0)
            self.assertEqual(observatory.conn.execute("SELECT post_total FROM daily_metrics").fetchone()[0], 2)
        finally:
            observatory.close()

    def test_delete_and_inactive_account_remove_candidate_rows(self) -> None:
        event = create_event("1788307200000000", "one", "Description")
        delete = {"kind": "commit", "time_us": "1788307201000000", "did": "did:plc:author", "commit": {"collection": "app.bsky.feed.post", "operation": "delete", "rkey": "one"}}
        account = {"kind": "account", "time_us": "1788307202000000", "did": "did:plc:author", "account": {"active": False}}
        write_segment(self.raw, "events", [event, delete, account])
        observatory = self.open()
        try:
            observatory.ingest()
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0], 0)
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM published_samples WHERE deleted = 0").fetchone()[0], 0)
        finally:
            observatory.close()

    def test_corrupt_segment_prevents_checkpointing_later_segments(self) -> None:
        write_segment(self.raw, "a", [create_event("1788307200000000", "a", "One")], corrupt=True)
        write_segment(self.raw, "b", [create_event("1788307201000000", "b", "Two")])
        observatory = self.open()
        try:
            with self.assertRaises(publisher.SegmentError):
                observatory.ingest()
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM segments").fetchone()[0], 0)
        finally:
            observatory.close()

    def test_bottom_k_is_order_independent(self) -> None:
        old = publisher.SAMPLE_CANDIDATES
        publisher.SAMPLE_CANDIDATES = 2
        try:
            expected: set[str] | None = None
            for order in (("a", "b", "c", "d"), ("d", "b", "a", "c")):
                root = pathlib.Path(tempfile.mkdtemp(dir=self.temp.name))
                raw, state = root / "raw", root / "state"
                raw.mkdir()
                state.mkdir()
                (state / "sampling.key").write_bytes(b"deterministic-test-key-012345678901")
                for index, name in enumerate(order):
                    value = ord(name) - ord("a")
                    write_segment(raw, name, [create_event(str(1788307200000000 + value), name, f"Alt {name}")])
                observatory = publisher.Observatory(publisher.Config(raw_dir=raw, state_dir=state))
                try:
                    observatory.ingest()
                    observed = {row[0] for row in observatory.conn.execute("SELECT alt_text FROM candidates")}
                finally:
                    observatory.close()
                if expected is None:
                    expected = observed
                else:
                    self.assertEqual(observed, expected)
        finally:
            publisher.SAMPLE_CANDIDATES = old

    def test_language_normalization_is_declared_only(self) -> None:
        self.assertEqual(publisher.normalized_languages({"langs": ["PT_br", "pt-BR"]}), ("pt", ["pt-br"]))
        self.assertEqual(publisher.normalized_languages({"langs": ["not a language", 5]}), ("unknown", []))
        self.assertEqual(publisher.normalized_languages({}), ("unknown", []))

    def test_sampling_waits_two_complete_correction_days_and_weights_rows(self) -> None:
        write_segment(self.raw, "events", [
            create_event("1788307200000000", "one", ["One", "Two"]),
            create_event("1788307201000000", "two", "Three"),
        ])
        on_september_four = datetime(2026, 9, 4, 0, 0, tzinfo=UTC)
        on_september_five = datetime(2026, 9, 5, 0, 0, tzinfo=UTC)
        observatory = self.open()
        try:
            with mock.patch.object(publisher, "utc_now", return_value=on_september_four):
                observatory.ingest()
                observatory.finalize_samples()
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM published_samples").fetchone()[0], 0)
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0], 3)
            with mock.patch.object(publisher, "utc_now", return_value=on_september_five):
                observatory.finalize_samples()
            rows = observatory.conn.execute("SELECT sampling_weight FROM published_samples").fetchall()
            self.assertEqual(len(rows), 3)
            self.assertEqual({row[0] for row in rows}, {1.0})
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0], 0)
        finally:
            observatory.close()

    def test_local_state_cap_pauses_rows_but_keeps_aggregates(self) -> None:
        write_segment(self.raw, "events", [create_event("1788307200000000", "one", "Description")])
        observatory = publisher.Observatory(publisher.Config(
            raw_dir=self.raw,
            state_dir=self.state,
            state_cap_bytes=1,
        ))
        try:
            observatory.ingest()
            self.assertEqual(observatory.conn.execute("SELECT post_total FROM daily_metrics").fetchone()[0], 1)
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0], 0)
            self.assertEqual(observatory._meta("sampling_paused"), "1")
            status = json.loads((self.state / "public-snapshot.json").read_text())["status"]
            self.assertTrue(status["samplingPaused"])
            self.assertFalse(status["sampleUploadPaused"])
        finally:
            observatory.close()

    @unittest.skipUnless(importlib.util.find_spec("pyarrow"), "PyArrow is installed only in the publisher environment")
    def test_parquet_schema_is_stable_and_export_is_allowlisted(self) -> None:
        write_segment(self.raw, "events", [create_event("1788307200000000", "one", "Description")])
        observatory = self.open()
        try:
            with mock.patch.object(publisher, "utc_now", return_value=datetime(2026, 9, 5, tzinfo=UTC)):
                observatory.ingest()
            rows = observatory._parquet_rows("description_sample", "2026-09")
            output = pathlib.Path(self.temp.name) / "sample.parquet"
            self.assertEqual(observatory._write_parquet(output, rows, "description_sample"), 1)
            import pyarrow.parquet as pq
            table = pq.read_table(output)
            self.assertEqual(tuple(table.schema.names), publisher.EXPORT_FIELDS["description_sample"])
            self.assertEqual(table.num_rows, 1)
            with self.assertRaisesRegex(RuntimeError, "export allowlist violation"):
                observatory._write_parquet(output, [{**rows[0], "did": "did:plc:forbidden"}], "description_sample")
        finally:
            observatory.close()

    @unittest.skipUnless(importlib.util.find_spec("pyarrow") and importlib.util.find_spec("huggingface_hub"), "Publisher dependencies are installed only in its virtual environment")
    def test_publish_is_atomic_noop_safe_and_removes_an_emptied_month(self) -> None:
        class FakeApi:
            def __init__(self) -> None:
                self.commits: list[list[object]] = []

            def create_repo(self, *_args, **_kwargs) -> None:
                return None

            def list_repo_tree(self, *_args, **_kwargs) -> list[object]:
                return []

            def create_commit(self, *_args, operations: list[object], **_kwargs) -> None:
                self.commits.append(operations)

        event = create_event("1788307200000000", "one", "Description")
        write_segment(self.raw, "a", [event])
        observatory = self.open()
        api = FakeApi()
        fixed_now = datetime(2026, 9, 5, tzinfo=UTC)
        try:
            with mock.patch.object(publisher, "utc_now", return_value=fixed_now):
                observatory.ingest()
                observatory._coverage = lambda _date, _minutes: "complete"  # type: ignore[method-assign]
                with mock.patch("huggingface_hub.HfApi", return_value=api):
                    first = observatory.publish()
            with mock.patch.object(publisher, "utc_now", return_value=datetime(2026, 9, 5, 1, tzinfo=UTC)):
                with mock.patch("huggingface_hub.HfApi", return_value=api):
                    second = observatory.publish()
            self.assertTrue(first["committed"])
            self.assertEqual(second, {"committed": False, "reason": "no changes"})
            self.assertEqual(len(api.commits), 1)
            self.assertEqual(json.loads(observatory._meta("published_sample_bins") or "{}")["len_1_25"], 1)

            delete = {"kind": "commit", "time_us": "1788307201000000", "did": "did:plc:author", "commit": {"collection": "app.bsky.feed.post", "operation": "delete", "rkey": "one"}}
            write_segment(self.raw, "b", [delete])
            with mock.patch.object(publisher, "utc_now", return_value=fixed_now):
                observatory.ingest()
                with mock.patch("huggingface_hub.HfApi", return_value=api):
                    replaced = observatory.publish()
            self.assertTrue(replaced["committed"])
            self.assertEqual(len(api.commits), 2)
            self.assertTrue(any(operation.__class__.__name__ == "CommitOperationDelete" for operation in api.commits[-1]))
            self.assertEqual(json.loads(observatory._meta("published_sample_bins") or "{}")["len_1_25"], 0)
        finally:
            observatory.close()

    @unittest.skipUnless(importlib.util.find_spec("pyarrow") and importlib.util.find_spec("huggingface_hub"), "Publisher dependencies are installed only in its virtual environment")
    def test_failed_upload_preserves_checkpoint_and_publication_manifest(self) -> None:
        class FailingApi:
            def create_repo(self, *_args, **_kwargs) -> None:
                return None

            def list_repo_tree(self, *_args, **_kwargs) -> list[object]:
                return []

            def create_commit(self, *_args, **_kwargs) -> None:
                raise RuntimeError("simulated upload failure")

        write_segment(self.raw, "events", [create_event("1788307200000000", "one", "Description")])
        observatory = self.open()
        fixed_now = datetime(2026, 9, 5, tzinfo=UTC)
        try:
            with mock.patch.object(publisher, "utc_now", return_value=fixed_now):
                observatory.ingest()
                observatory._coverage = lambda _date, _minutes: "complete"  # type: ignore[method-assign]
                checkpoint = observatory.conn.execute("SELECT path, sha256 FROM segments").fetchall()
                with mock.patch("huggingface_hub.HfApi", return_value=FailingApi()):
                    with self.assertRaisesRegex(RuntimeError, "simulated upload failure"):
                        observatory.publish()
            self.assertEqual(observatory.conn.execute("SELECT COUNT(*) FROM published_files").fetchone()[0], 0)
            self.assertEqual(observatory.conn.execute("SELECT path, sha256 FROM segments").fetchall(), checkpoint)
        finally:
            observatory.close()


if __name__ == "__main__":
    unittest.main()
