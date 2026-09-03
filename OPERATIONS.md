# Firehose operations

Production URL: `https://dr.eamer.dev/bluesky/firehose/` · Loopback service:
`127.0.0.1:5052` · Unit: `firehose.service` · Working tree:
`/home/coolhand/servers/firehose` · Aggregate database:
`/home/coolhand/servers/firehose/firehose.db`

Native systemd and the live Caddyfile are authoritative on drummer. The legacy
`service_manager.py` / `sm` registry is not the production control plane.

## Storage model

The service deliberately separates three different products:

| Data | Format | Default | Retention |
| --- | --- | --- | --- |
| Dashboard history | SQLite minute counts only | Always on | 48 hours |
| Filtered research corpus | SQLite `posts` rows | Off; operator collection windows | Operator-managed |
| Raw observatory event log | Rotated NDJSON.zst segments | Explicit opt-in | 24 hours and 2 GiB by default |
| Accessibility observatory state | SQLite + public-safe JSON snapshot | Separate timers | 5 GiB hard sampling envelope |

The public Socket.IO stream is never sampled. Filters affect only an individual
browser view. The browser keeps all posts received since page load and
virtualizes the feed cards, so scrollback grows without growing the rendered
DOM; a reload begins a new browser session. Raw archive pressure or failure
must not stop the public stream, English-tagged sentiment analysis, or aggregate history.

The dashboard's mood and sentiment panel use a rolling five-minute window of
posts explicitly tagged with an English BCP 47 language code. The analyzer is
the English AFINN lexicon bundled by `sentiment`; posts in all other languages
remain visible in the full stream and are marked `not scored`.

## Raw archive design

`RawArchiveRecorder` uses a separate Jetstream subscription from the public
display. This separation is important: cursor replay after a recorder restart
cannot flood the public UI with old events or double-count dashboard metrics.

Archive format v2 stores `app.bsky.feed.post` commit envelopes for create,
update, and delete operations, plus Jetstream v1 `account` and `identity`
markers. It ignores commits from unrelated collections. Deployed Jetstream v1
does not emit `sync` markers, so downstream state is deletion-responsive rather
than a perfect present-network mirror.
Segments are:

- NDJSON compressed by `zstd -3`;
- written as mode-0600 `.partial` files;
- sealed by atomic rename every 15 minutes or 128 MiB of raw input;
- accompanied by a JSON manifest containing counts, first/last cursor, byte
  sizes, timestamps, archive version/event kinds, and SHA-256;
- checkpointed only after a segment is sealed successfully;
- deduplicated across same-process reconnects, while downstream consumers must
  still be idempotent because Jetstream delivery is at-least-once.

Interrupted `.partial` files are never treated as sealed data. They count toward
the quota and age out under the same retention rule.

### Capacity basis

On 2026-09-02, an in-memory 29.61-second production sample measured:

- 1,386 post events;
- 822 raw bytes/event;
- 240 zstd bytes/event;
- 0.292 compressed/raw ratio;
- approximately 0.90 GiB/day at the observed event rate.

The first 15-minute production segment then sealed 47,482 events: 41.1 MB raw
became 11.5 MB zstd (0.279 ratio), or approximately 1.03 GiB/day if that rate
were sustained. Its zstd integrity, manifest SHA-256, and durable checkpoint
were verified while the next segment continued recording with zero drops.

This is a point-in-time measurement, not a permanent forecast. The byte quota
is the safety mechanism when traffic or payload sizes grow.

### Configuration

```dotenv
RAW_ARCHIVE_ENABLED=0
RAW_ARCHIVE_DIR=/home/coolhand/firehose-data/raw
RAW_ARCHIVE_RETENTION_HOURS=24
RAW_ARCHIVE_MAX_BYTES=2147483648
RAW_ARCHIVE_MIN_FREE_BYTES=10737418240
RAW_ARCHIVE_ROTATE_MINUTES=15
RAW_ARCHIVE_SEGMENT_RAW_BYTES=134217728
RAW_ARCHIVE_QUEUE_BYTES=16777216
```

Production should set these in a mode-0600 environment file, not inline in the
systemd unit. `RAW_ARCHIVE_ENABLED=1` is the explicit opt-in. The default local
envelope retains about one day while preventing the spool from exceeding 2 GiB
or continuing when the filesystem has less than 10 GiB free.

### Archive status

The public-safe tRPC endpoint returns health metadata but never raw content or
the archive filesystem path:

```text
GET /api/trpc/firehose.archiveStatus
```

Important fields: `enabled`, `connected`, `recording`, `pausedReason`,
`sealedBytes`, `segmentCount`, `partialCount`, `eventsRecorded`,
`eventsDropped`, `lastEventAt`, `lastSealedAt`, and `resumeCursor`.

On drummer, inspect the path directly without printing post content:

```bash
du -sh /home/coolhand/firehose-data/raw
find /home/coolhand/firehose-data/raw -type f -name '*.manifest.json' -print
```

## Off-host retention

The recorder's local spool is copied hourly to Beast's mounted Galactus backup
volume by `firehose-archive-backup.timer` on drummer. Beast's internal data
volume is not used: the remote script fails closed unless Galactus is mounted
and has at least 100 GiB free. Galactus had about 6.2 TiB free when the guard
and integrity jobs were validated on 2026-09-03.

Recovery note: Galactus became unmounted after the successful 2026-09-02
19:04 UTC run, and the hourly service failed closed rather than falling back to
Beast's internal disk. It was remounted on 2026-09-03 and the hourly job has
remained healthy. At the 09:06 UTC readiness baseline, drummer held 80 sealed
pairs (696,909,376 compressed bytes) and Galactus held 80 verified pairs. The
targeted Firehose subtree on geepers held 49 verified pairs, but geepers was 96%
used with about 37 GiB free. Broad Galactus mirroring is therefore suspended;
its 100 GiB destination guard must remain in force until space is reclaimed or
storage is added.

Destination:

```text
/Volumes/Galactus/Data/Backups/Firehose/raw
```

Only sealed `.ndjson.zst` segments and their manifests are transferred. The
job never copies `.partial` files or the mutable recorder checkpoint. Each new
segment is checked against the manifest byte count and SHA-256 before a local
`.verified` marker is written. Transfer is additive/idempotent; Galactus keeps
30 days under this dedicated root.

The Beast-side script is source-controlled at
`deploy/beast/firehose-archive-backup.sh` and installed at
`/Users/luke/bin/firehose-archive-backup.sh`. Its default `backup` mode performs
the bounded hourly transfer. `audit` recomputes every destination checksum and
compares a consistent source manifest inventory; `restore-drill` additionally
copies the newest sealed pair to an isolated temporary directory, verifies it,
and removes the temporary copy. Audit and restore modes never apply retention.
The scheduler deliberately runs on always-on drummer because a newly-created
Beast LaunchAgent was denied background access to the external volume by
macOS. Inspect with:

```bash
systemctl status firehose-archive-backup.timer
systemctl status firehose-archive-backup.service
systemctl status firehose-archive-integrity.timer
systemctl status firehose-archive-restore-drill.timer
journalctl -u firehose-archive-backup.service
```

Beast's existing GitHub collector is separate. It runs nightly to Galactus and
verifies its own promoted run. Galactus's later additive mirror to `geepers` is
not currently a second durable copy: geepers was full on 2026-09-02. The mirror
script was corrected to exit nonzero when any selected path fails; its tracked
copy is `~/admin/bin/beast-mirror-to-geepers.sh`. No geepers data was removed
in this change.

Do not put the spool under a broad backup root unless that backup explicitly
excludes or budgets it; otherwise each local day can be multiplied across
snapshots.

Additional tiers should likewise ship **sealed files and their manifests only**.
Immutable files make `rsync --ignore-existing` or object-storage upload simple.
Delete local sealed segments only through the recorder's time/byte policy. The
accessibility publisher is the only current Parquet projection; do not
re-inflate the general firehose into row-per-post SQLite.

## Accessibility observatory

`observatory/publisher.py` is isolated from `firehose.service`. Ingest runs on
sealed, checksum-verified archive-format-v2 segments every 15 minutes; publish
runs daily at 03:15 UTC. A corrupt or missing segment aborts the run before any
later segment is checkpointed. Archive-format-v1 segments are acknowledged but
excluded so the longitudinal series begins as a clean deployment epoch.

The publisher stores exact create-time aggregates, a seven-day 128-bit event
fingerprint ledger, and up to 5,000 deterministic bottom-k candidates per UTC
day. After two complete correction days have elapsed, it promotes at most 2,000
descriptions per day and discards the rest. Post-deletion and inactive-account
markers remove matching sample rows and trigger a monthly shard replacement;
historical aggregate observations are not rewritten.

Public export is allowlisted. It excludes post text, image bytes and URLs,
CIDs, raw records, DIDs, and handles. Author IDs are keyed, month-scoped
pseudonyms—not anonymous identifiers. A 5 GiB local cap pauses new row sampling
while aggregates continue. A separate 2 GiB Hugging Face repository ceiling
stops new sample shards while local sampling, aggregate uploads, and deletion
rewrites continue.

Install and verify without enabling timers:

```bash
bash observatory/install-venv.sh
observatory/.venv/bin/python -m unittest -v observatory/test_publisher.py
install -d -m 0700 /home/coolhand/firehose-data/observatory
install -m 0600 deploy/firehose-observatory.env.example /etc/dreamer/firehose-observatory.env
```

The `/etc/dreamer` install and systemd unit install require operator privileges.
Hugging Face authentication comes from the existing drummer login; never put a
token in the example environment file or a unit. Before enabling publication,
run an ingest and a dry-run publish, inspect only aggregate/schematic output,
and confirm the dataset account with a non-secret identity check.

Expected units:

```text
firehose-observatory-ingest.service
firehose-observatory-ingest.timer
firehose-observatory-publish.service
firehose-observatory-publish.timer
firehose-observatory-readiness.service
firehose-observatory-readiness.timer
```

The publisher runs at 03:15 UTC. The readiness verifier follows at 04:00 UTC
and writes mode-0600 JSON reports beneath
`/home/coolhand/firehose-data/observatory/readiness/`. It downloads every
artifact from one immutable Hugging Face revision, requires exact agreement
between the remote manifest and local `published_files` ledger, validates the
latest complete month's Parquet schemas, counts, and checksums, compares stable
aggregate fields to local SQLite state, rejects descriptions newer than the
two-complete-day correction window, and probes both public browser routes.

Run the verifier without `--require-complete` during the initial partial day.
Once the first complete UTC date is due, the timer uses `--require-complete` so
a missing publication fails visibly:

```bash
observatory/.venv/bin/python observatory/readiness.py
observatory/.venv/bin/python observatory/readiness.py --require-complete
```

The archive integrity audit runs daily at 04:30 UTC. The sealed-segment restore
drill runs Sundays at 05:00 UTC. Both execute the same installed Beast script
used by the hourly backup, so mount and free-space checks apply consistently.

Rollback is independent of the dashboard: disable the observatory timers and
remove the Caddy alias. The live stream and raw archive continue unchanged.

The storage-tier responsibilities, first-publication gate, 72-hour observation
window, and encrypted-cloud decision gate are in
[`docs/storage-readiness.md`](docs/storage-readiness.md).

## Routine checks

```bash
systemctl is-active firehose
systemctl show firehose -p MainPID -p ActiveEnterTimestamp -p WorkingDirectory
ss -lntp | grep ':5052'
curl -sS http://127.0.0.1:5052/
curl -sS https://dr.eamer.dev/bluesky/firehose/
df -h /home/coolhand
du -sh /home/coolhand/servers/firehose/firehose.db*
```

Query counts without exposing post text:

```bash
sqlite3 /home/coolhand/servers/firehose/firehose.db \
  "select 'posts', count(*) from posts union all select 'minutes', count(*) from statsMinute;"
```

The `posts` count may legitimately be zero. Minute tables should continue to
grow while the public stream is running.

## Collection controls

The filtered SQLite research corpus is separate from the full raw archive.
Controls are authenticated-admin or direct-loopback only:

```bash
./scripts/start-collection.sh [window-name]
./scripts/stop-collection.sh
```

Collection filters currently retain likely-English, original, 10–500-word
posts with bounded link/mention saturation. Pausing collection does not pause
the dashboard, aggregate history, or raw recorder.

## Build and deploy

```bash
pnpm check
pnpm test
pnpm build
```

`dist/public` must be reproducible from `client/src`; there is no supported
post-build bundle patch. Before replacing production artifacts:

1. Capture the current `dist/public`, `dist/index.js`, source files, and unit
   definition in a timestamped rollback directory.
2. Build in an isolated worktree.
3. Compare the clean build with the live page at desktop and mobile widths.
4. Copy the verified build into the live working tree without deleting runtime
   data.
5. Restart `firehose.service` and probe loopback/public HTTP, Socket.IO, tRPC
   history, archive status, and the public security boundary.

The production runtime is pinned in `start.sh` to the Node installation whose
ABI matches `better-sqlite3`. A different Node major can make the service fail
before it binds its port.

## Failure behavior

- `pausedReason: archive byte quota reached`: retention could not reduce the
  spool below its hard cap. The dashboard continues; inspect sealed/partial
  sizes and destination capacity.
- `pausedReason: minimum free disk floor reached`: free space is below the
  configured floor. Do not lower the floor casually.
- `pausedReason: writer error`: zstd or the filesystem failed. Preserve the
  `.partial` file, fix the cause, then restart after checking capacity.
- `eventsDropped > 0`: raw archive completeness is not guaranteed for the
  current run. Jetstream cursor replay may recover recent gaps if still inside
  the provider's lookback window.
- No dashboard posts: check `connected`, `lastEventAt`, service logs, and the
  upstream Jetstream connection. Do not infer a database problem; the display
  does not depend on raw rows.

Use graceful systemd restarts. Do not remove SQLite WAL/SHM files or raw archive
partials while the service is running.
