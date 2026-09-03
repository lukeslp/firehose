# Firehose storage and publication readiness

This is the operating policy for the Bluesky accessibility observatory. It
separates publication, working retention, and disaster recovery so that a
healthy cloud login is never mistaken for a verified backup.

## Storage tiers

| Tier | Contents | Current home | Policy |
| --- | --- | --- | --- |
| Public | Redacted aggregates and delayed, correction-responsive description samples | Hugging Face plus the two browser routes | Publish only allowlisted Parquet fields. Samples wait two complete correction days. No raw records, handles, DIDs, image URLs, or credentials. |
| Working archive | Bounded sealed archive-format-v2 event segments and manifests | drummer local spool | Keep the recorder's 24-hour / 2 GiB envelope. Partial files and the mutable checkpoint never leave this tier. |
| Recovery | Immutable sealed pairs and verification evidence | Galactus; targeted geepers copy; one future encrypted cloud target | Transfer additively, verify SHA-256 and byte counts, enforce destination headroom, and prove restoration periodically. |

Galactus is the active recovery copy. Geepers is not a dependable broad backup
while its filesystem remains 96% used: only the already-targeted Firehose copy
may remain, and broad Galactus mirroring stays suspended behind the 100 GiB
minimum-free-space guard.

## September 3 baseline

The 09:06 UTC baseline recorded:

- drummer: 80 sealed segment/manifest pairs, 696,909,376 compressed bytes;
- Galactus: 80 pairs with 80 verification markers and about 6.2 TiB free;
- geepers: 49 verified pairs, about 37 GiB free, 96% used;
- observatory state: September 2 partial, September 3 in progress, 9,977
  candidates, zero published samples;
- Hugging Face revision `0b115d4dfe9b50777856edd84915af4610e11ee3`:
  documentation and manifest only, as expected before the first complete day;
- Google and Proton roots present, but neither provider has a verified sync and
  restore path. Their presence is not recovery evidence.

## First-publication gate

The September 4 03:15 UTC publisher run is the first run expected to contain a
complete UTC date. The 04:00 readiness verifier must prove all of the following
from one immutable dataset revision:

1. The remote manifest exactly matches the local publication ledger.
2. Every selected Parquet checksum, schema, and row count is correct.
3. Daily and declared-language aggregates match local SQLite state.
4. The description sample still withholds records inside the correction window.
5. Both observatory and download routes work from an unauthenticated client.
6. A mode-0600 report records the verified revision and archive baseline.

A failed gate does not authorize manual edits to public artifacts. Preserve the
failed report, inspect publisher logs and state, correct the source cause, and
republish atomically.

## Seventy-two-hour readiness window

Run from the first complete publication through three daily verifier reports.
Record:

- each publisher and readiness service result;
- public aggregate and sample row counts by immutable revision;
- daily source archive growth and spool pressure;
- at least two successful hourly Galactus backup cycles after publication;
- one full checksum audit and one sealed-pair restore drill;
- geepers free bytes without broad mirroring;
- read-only Google and Proton client/root health, without enabling uploads.

Use the measured daily growth—not the first short sample—to set recovery
retention and cloud quota. Stop the window and investigate if any checksum
drifts, a source pair is missing at the destination, a public ledger diverges,
the correction window is breached, Galactus falls below 100 GiB free, or
geepers loses further material headroom.

## Encrypted cloud gate

Choose one provider only after the 72-hour measurements. The first cloud copy
must use client-side encryption, a fixed size/retention ceiling, immutable
sealed pairs, checksum manifests, and credentials unavailable to the public
publisher. A provider is accepted only after a sealed segment is restored to a
clean temporary location and independently verified. Add the second provider
later for diversity only after the first workflow has demonstrated both backup
and restore.
