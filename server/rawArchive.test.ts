import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { zstdDecompressSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { RawArchiveWriter } from './rawArchive';

const roots: string[] = [];

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'firehose-raw-'));
  roots.push(root);
  return root;
}

function files(root: string, suffix: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map(entry => path.join(root, entry))
    .filter(file => file.endsWith(suffix));
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('RawArchiveWriter', () => {
  it('seals valid zstd NDJSON and checkpoints the last durable cursor', async () => {
    const root = temporaryRoot();
    const writer = new RawArchiveWriter({ enabled: true, rootDir: root, minFreeBytes: 1, maxBytes: 10_000_000 });
    expect(writer.record('{"time_us":1,"kind":"commit"}', '1', 'one')).toBe(true);
    expect(writer.record('{"time_us":2,"kind":"commit"}', '2', 'two')).toBe(true);
    await writer.seal();

    const segments = files(root, '.ndjson.zst');
    expect(segments).toHaveLength(1);
    const decoded = zstdDecompressSync(fs.readFileSync(segments[0])).toString('utf8');
    expect(decoded.trim().split('\n')).toHaveLength(2);
    expect(writer.status()).toMatchObject({ segmentCount: 1, partialCount: 0, eventsRecorded: 2, resumeCursor: '2' });

    const recovered = new RawArchiveWriter({ enabled: true, rootDir: root, minFreeBytes: 1, maxBytes: 10_000_000 });
    expect(recovered.resumeCursor).toBe('2');
    expect(recovered.resumeEventKey).toBe('two');
  });

  it('rotates by raw segment size without losing queued events', async () => {
    const root = temporaryRoot();
    const writer = new RawArchiveWriter({
      enabled: true,
      rootDir: root,
      minFreeBytes: 1,
      maxBytes: 10_000_000,
      maxSegmentRawBytes: 40,
    });
    for (let index = 0; index < 5; index += 1) {
      writer.record(JSON.stringify({ time_us: index, text: `event-${index}` }), String(index), `key-${index}`);
    }
    await writer.seal();
    expect(files(root, '.ndjson.zst').length).toBeGreaterThan(1);
    expect(writer.status().eventsRecorded).toBe(5);
    expect(writer.status().resumeCursor).toBe('4');
  });

  it('removes expired archive files and their manifests', () => {
    const root = temporaryRoot();
    const segment = path.join(root, 'old.ndjson.zst');
    const manifest = path.join(root, 'old.manifest.json');
    fs.writeFileSync(segment, 'old');
    fs.writeFileSync(manifest, '{}');
    const old = new Date(Date.now() - 3 * 60 * 60_000);
    fs.utimesSync(segment, old, old);
    fs.utimesSync(manifest, old, old);

    const writer = new RawArchiveWriter({ enabled: true, rootDir: root, retentionHours: 1, minFreeBytes: 1, maxBytes: 10_000_000 });
    expect(fs.existsSync(segment)).toBe(false);
    expect(fs.existsSync(manifest)).toBe(false);
    expect(writer.status().segmentCount).toBe(0);
  });

  it('pauses instead of growing when only interrupted data fills the quota', () => {
    const root = temporaryRoot();
    fs.writeFileSync(path.join(root, 'interrupted.ndjson.zst.partial'), Buffer.alloc(2_000));
    const writer = new RawArchiveWriter({ enabled: true, rootDir: root, minFreeBytes: 1, maxBytes: 1_000 });
    expect(writer.status().recording).toBe(false);
    expect(writer.status().pausedReason).toContain('quota');
    expect(writer.record('{}', '1', 'one')).toBe(false);
  });
});
