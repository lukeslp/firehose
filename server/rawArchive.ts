import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { constants as zlibConstants, createZstdCompress, type ZstdCompress } from 'node:zlib';
import WebSocket from 'ws';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const DEFAULT_JETSTREAM = 'wss://jetstream2.us-east.bsky.network/subscribe';

export interface RawArchiveOptions {
  enabled?: boolean;
  rootDir?: string;
  retentionHours?: number;
  maxBytes?: number;
  minFreeBytes?: number;
  rotateMinutes?: number;
  maxSegmentRawBytes?: number;
  maxQueueBytes?: number;
  now?: () => number;
}

export interface RawArchiveStatus {
  enabled: boolean;
  recording: boolean;
  pausedReason: string | null;
  rootDir: string;
  retentionHours: number;
  maxBytes: number;
  sealedBytes: number;
  segmentCount: number;
  partialCount: number;
  eventsRecorded: number;
  eventsDropped: number;
  queueBytes: number;
  lastEventAt: string | null;
  lastSealedAt: string | null;
  resumeCursor: string | null;
}

interface ArchiveEntry {
  payload: Buffer;
  cursor: string;
  eventKey: string;
  receivedAt: string;
}

interface Checkpoint {
  formatVersion: 1 | 2;
  cursor: string;
  eventKey: string;
  sealedAt: string;
  segment: string;
}

/**
 * The deployed Jetstream v1 endpoint has commit, account, and identity
 * markers (but no sync marker). Keep only post commits plus those markers so
 * the archive remains bounded enough for its existing raw-spool contract.
 */
export function archiveEventDetails(message: Record<string, any>): { cursor: string; eventKey: string } | null {
  const cursor = String(message.seq ?? message.time_us ?? '');
  if (!cursor) return null;
  const kind = String(message.kind ?? '');
  const did = String(message.did ?? message.identity?.did ?? message.account?.did ?? '');
  if (!did) return null;
  if (kind === 'commit') {
    const commit = message.commit;
    if (commit?.collection !== 'app.bsky.feed.post') return null;
    return {
      cursor,
      eventKey: [kind, cursor, did, commit.operation ?? '', commit.rkey ?? '', commit.cid ?? ''].join('|'),
    };
  }
  if (kind === 'account' || kind === 'identity') {
    const marker = kind === 'account' ? message.account : message.identity;
    return {
      cursor,
      // Cursor makes a marker idempotent across replay without conflating a
      // later account-state transition for the same DID.
      eventKey: [kind, cursor, did, marker?.active ?? '', marker?.handle ?? ''].join('|'),
    };
  }
  return null;
}

interface Segment {
  compressor: ZstdCompress;
  output: fs.WriteStream;
  partialPath: string;
  startedAt: number;
  firstCursor: string;
  lastCursor: string;
  lastEventKey: string;
  firstEventAt: string;
  lastEventAt: string;
  eventCount: number;
  rawBytes: number;
  compressedBytes: number;
  hash: ReturnType<typeof createHash>;
}

interface FileInventory {
  sealed: Array<{ file: string; size: number; mtimeMs: number }>;
  partial: Array<{ file: string; size: number; mtimeMs: number }>;
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function archiveFiles(rootDir: string): FileInventory {
  const result: FileInventory = { sealed: [], partial: [] };
  if (!fs.existsSync(rootDir)) return result;

  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(file);
      } else if (entry.isFile() && (entry.name.endsWith('.ndjson.zst') || entry.name.endsWith('.ndjson.zst.partial'))) {
        const stats = fs.statSync(file);
        const target = entry.name.endsWith('.partial') ? result.partial : result.sealed;
        target.push({ file, size: stats.size, mtimeMs: stats.mtimeMs });
      }
    }
  };

  visit(rootDir);
  return result;
}

function safeUnlink(rootDir: string, file: string) {
  const resolvedRoot = path.resolve(rootDir) + path.sep;
  const resolvedFile = path.resolve(file);
  if (!resolvedFile.startsWith(resolvedRoot)) throw new Error('Refusing to remove a file outside the archive root');
  if (!resolvedFile.endsWith('.ndjson.zst') && !resolvedFile.endsWith('.ndjson.zst.partial') && !resolvedFile.endsWith('.manifest.json')) {
    throw new Error('Refusing to remove an unexpected archive file');
  }
  if (fs.existsSync(resolvedFile)) fs.unlinkSync(resolvedFile);
}

function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(temporary, 'w', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temporary, file);
  fsyncDirectory(path.dirname(file));
}

function fsyncFile(file: string) {
  const fd = fs.openSync(file, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function fsyncDirectory(dir: string) {
  const fd = fs.openSync(dir, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export class RawArchiveWriter extends EventEmitter {
  private readonly enabled: boolean;
  private readonly rootDir: string;
  private readonly retentionHours: number;
  private readonly maxBytes: number;
  private readonly minFreeBytes: number;
  private readonly rotateMs: number;
  private readonly maxSegmentRawBytes: number;
  private readonly maxQueueBytes: number;
  private readonly now: () => number;
  private readonly queue: ArchiveEntry[] = [];
  private queueBytes = 0;
  private pumping: Promise<void> | null = null;
  private segment: Segment | null = null;
  private pausedReason: string | null = null;
  private eventsRecorded = 0;
  private eventsDropped = 0;
  private lastEventAt: string | null = null;
  private lastSealedAt: string | null = null;
  private checkpoint: Checkpoint | null = null;
  private segmentSequence = 0;

  constructor(options: RawArchiveOptions = {}) {
    super();
    this.enabled = options.enabled ?? process.env.RAW_ARCHIVE_ENABLED === '1';
    this.rootDir = path.resolve(options.rootDir ?? process.env.RAW_ARCHIVE_DIR ?? path.join(process.cwd(), 'raw-archive'));
    this.retentionHours = options.retentionHours ?? positiveNumber(process.env.RAW_ARCHIVE_RETENTION_HOURS, 24);
    this.maxBytes = options.maxBytes ?? positiveNumber(process.env.RAW_ARCHIVE_MAX_BYTES, 2 * GIB);
    this.minFreeBytes = options.minFreeBytes ?? positiveNumber(process.env.RAW_ARCHIVE_MIN_FREE_BYTES, 10 * GIB);
    this.rotateMs = (options.rotateMinutes ?? positiveNumber(process.env.RAW_ARCHIVE_ROTATE_MINUTES, 15)) * 60_000;
    this.maxSegmentRawBytes = options.maxSegmentRawBytes ?? positiveNumber(process.env.RAW_ARCHIVE_SEGMENT_RAW_BYTES, 128 * MIB);
    this.maxQueueBytes = options.maxQueueBytes ?? positiveNumber(process.env.RAW_ARCHIVE_QUEUE_BYTES, 16 * MIB);
    this.now = options.now ?? Date.now;

    if (this.enabled) {
      fs.mkdirSync(this.rootDir, { recursive: true, mode: 0o700 });
      this.checkpoint = this.readCheckpoint();
      this.maintain();
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  get resumeCursor() {
    return this.checkpoint?.cursor ?? null;
  }

  get resumeEventKey() {
    return this.checkpoint?.eventKey ?? null;
  }

  record(payload: Buffer | string, cursor: string, eventKey: string) {
    if (!this.enabled || this.pausedReason) {
      this.eventsDropped += 1;
      return false;
    }

    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const lineBytes = body.length + 1;
    if (this.queueBytes + lineBytes > this.maxQueueBytes) {
      this.pausedReason = 'writer queue reached its hard limit';
      this.eventsDropped += 1;
      this.emit('paused', this.pausedReason);
      return false;
    }

    this.queue.push({
      payload: body,
      cursor,
      eventKey,
      receivedAt: new Date(this.now()).toISOString(),
    });
    this.queueBytes += lineBytes;
    this.pumping ??= this.pump().catch(error => {
      this.pauseForWriter(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      this.pumping = null;
      if (this.queue.length > 0 && !this.pausedReason) {
        this.pumping = this.pump().catch(error => {
          this.pauseForWriter(error instanceof Error ? error.message : String(error));
        }).finally(() => { this.pumping = null; });
      }
    });
    return true;
  }

  async flush() {
    while (this.pumping) await this.pumping;
  }

  async seal() {
    await this.flush();
    await this.sealSegment();
  }

  async stop() {
    await this.seal();
  }

  maintain() {
    if (!this.enabled) return;
    const now = this.now();
    const cutoff = now - this.retentionHours * 60 * 60_000;
    let inventory = archiveFiles(this.rootDir);

    for (const entry of [...inventory.sealed, ...inventory.partial]) {
      if (entry.mtimeMs >= cutoff) continue;
      safeUnlink(this.rootDir, entry.file);
      if (entry.file.endsWith('.ndjson.zst')) {
        safeUnlink(this.rootDir, entry.file.replace(/\.ndjson\.zst$/, '.manifest.json'));
      }
    }

    inventory = archiveFiles(this.rootDir);
    let totalBytes = [...inventory.sealed, ...inventory.partial].reduce((sum, entry) => sum + entry.size, 0);
    const oldestFirst = [...inventory.sealed].sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const entry of oldestFirst) {
      if (totalBytes <= this.maxBytes) break;
      safeUnlink(this.rootDir, entry.file);
      safeUnlink(this.rootDir, entry.file.replace(/\.ndjson\.zst$/, '.manifest.json'));
      totalBytes -= entry.size;
    }

    const filesystem = fs.statfsSync(this.rootDir);
    const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
    const remaining = archiveFiles(this.rootDir);
    const remainingBytes = [...remaining.sealed, ...remaining.partial].reduce((sum, entry) => sum + entry.size, 0);
    if (remainingBytes >= this.maxBytes) {
      this.pausedReason = 'archive byte quota reached';
    } else if (freeBytes < this.minFreeBytes) {
      this.pausedReason = 'minimum free disk floor reached';
    } else if (this.pausedReason === 'archive byte quota reached' || this.pausedReason === 'minimum free disk floor reached') {
      this.pausedReason = null;
    }
  }

  status(): RawArchiveStatus {
    const inventory = archiveFiles(this.rootDir);
    return {
      enabled: this.enabled,
      recording: this.enabled && !this.pausedReason,
      pausedReason: this.pausedReason,
      rootDir: this.rootDir,
      retentionHours: this.retentionHours,
      maxBytes: this.maxBytes,
      sealedBytes: inventory.sealed.reduce((sum, entry) => sum + entry.size, 0),
      segmentCount: inventory.sealed.length,
      partialCount: inventory.partial.length,
      eventsRecorded: this.eventsRecorded,
      eventsDropped: this.eventsDropped,
      queueBytes: this.queueBytes,
      lastEventAt: this.lastEventAt,
      lastSealedAt: this.lastSealedAt,
      resumeCursor: this.resumeCursor,
    };
  }

  private async pump() {
    while (this.queue.length > 0 && !this.pausedReason) {
      const next = this.queue.shift();
      if (!next) break;
      this.queueBytes -= next.payload.length + 1;

      if (this.segment && (this.now() - this.segment.startedAt >= this.rotateMs || this.segment.rawBytes >= this.maxSegmentRawBytes)) {
        await this.sealSegment();
        this.maintain();
        if (this.pausedReason) {
          this.eventsDropped += this.queue.length + 1;
          this.queue.length = 0;
          this.queueBytes = 0;
          break;
        }
      }

      this.segment ??= this.openSegment(next);
      await this.writeLine(this.segment, next.payload);
      this.segment.lastCursor = next.cursor;
      this.segment.lastEventKey = next.eventKey;
      this.segment.lastEventAt = next.receivedAt;
      this.segment.eventCount += 1;
      this.segment.rawBytes += next.payload.length + 1;
      this.eventsRecorded += 1;
      this.lastEventAt = next.receivedAt;
    }
  }

  private openSegment(first: ArchiveEntry): Segment {
    const startedAt = this.now();
    const date = new Date(startedAt);
    const dir = path.join(
      this.rootDir,
      String(date.getUTCFullYear()),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
      String(date.getUTCHours()).padStart(2, '0'),
    );
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    this.segmentSequence += 1;
    const partialPath = path.join(
      dir,
      `events-${stamp}-${process.pid}-${String(this.segmentSequence).padStart(4, '0')}.ndjson.zst.partial`,
    );
    const output = fs.createWriteStream(partialPath, { flags: 'wx', mode: 0o600 });
    const compressor = createZstdCompress({
      params: { [zlibConstants.ZSTD_c_compressionLevel]: 3 },
    });
    const segment: Segment = {
      compressor,
      output,
      partialPath,
      startedAt,
      firstCursor: first.cursor,
      lastCursor: first.cursor,
      lastEventKey: first.eventKey,
      firstEventAt: first.receivedAt,
      lastEventAt: first.receivedAt,
      eventCount: 0,
      rawBytes: 0,
      compressedBytes: 0,
      hash: createHash('sha256'),
    };

    compressor.on('data', (chunk: Buffer) => {
      segment.hash.update(chunk);
      segment.compressedBytes += chunk.length;
      if (!output.write(chunk)) {
        compressor.pause();
        output.once('drain', () => compressor.resume());
      }
    });
    compressor.on('error', error => this.pauseForWriter(`zstd compression failed: ${error.message}`));
    output.on('error', error => this.pauseForWriter(`archive write failed: ${error.message}`));
    return segment;
  }

  private writeLine(segment: Segment, payload: Buffer) {
    return new Promise<void>((resolve, reject) => {
      const line = Buffer.concat([payload, Buffer.from('\n')]);
      segment.compressor.write(line, error => error ? reject(error) : resolve());
    });
  }

  private async sealSegment() {
    const segment = this.segment;
    if (!segment) return;
    this.segment = null;

    try {
      const compressionEnded = new Promise<void>((resolve, reject) => {
        segment.compressor.once('end', resolve);
        segment.compressor.once('error', reject);
      });
      const outputFinished = new Promise<void>((resolve, reject) => {
        segment.output.once('finish', resolve);
        segment.output.once('error', reject);
      });
      segment.compressor.once('end', () => segment.output.end());
      segment.compressor.end();
      await Promise.all([compressionEnded, outputFinished]);

      const sealedPath = segment.partialPath.replace(/\.partial$/, '');
      fs.renameSync(segment.partialPath, sealedPath);
      fsyncFile(sealedPath);
      fsyncDirectory(path.dirname(sealedPath));
      const checksum = segment.hash.digest('hex');
      const sealedAt = new Date(this.now()).toISOString();
      const manifest = {
        formatVersion: 2,
        collections: ['app.bsky.feed.post'],
        eventKinds: ['commit', 'account', 'identity'],
        compression: 'zstd-3',
        firstCursor: segment.firstCursor,
        lastCursor: segment.lastCursor,
        firstEventAt: segment.firstEventAt,
        lastEventAt: segment.lastEventAt,
        sealedAt,
        eventCount: segment.eventCount,
        rawBytes: segment.rawBytes,
        compressedBytes: segment.compressedBytes,
        sha256: checksum,
      };
      const manifestPath = sealedPath.replace(/\.ndjson\.zst$/, '.manifest.json');
      atomicJson(manifestPath, manifest);
      this.checkpoint = {
        formatVersion: 2,
        cursor: segment.lastCursor,
        eventKey: segment.lastEventKey,
        sealedAt,
        segment: path.relative(this.rootDir, sealedPath),
      };
      atomicJson(path.join(this.rootDir, 'checkpoint.json'), this.checkpoint);
      this.lastSealedAt = sealedAt;
      this.emit('sealed', manifest);
    } catch (error) {
      this.pauseForWriter(error instanceof Error ? error.message : String(error));
    }
  }

  private readCheckpoint(): Checkpoint | null {
    const file = path.join(this.rootDir, 'checkpoint.json');
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Checkpoint>;
      if ((value.formatVersion === 1 || value.formatVersion === 2) && value.cursor && value.eventKey && value.segment && value.sealedAt) {
        return value as Checkpoint;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[RawArchive] Ignoring unreadable checkpoint:', error instanceof Error ? error.message : error);
      }
    }
    return null;
  }

  private pauseForWriter(reason: string) {
    this.pausedReason = `writer error: ${reason}`;
    this.eventsDropped += this.queue.length;
    this.queue.length = 0;
    this.queueBytes = 0;
    this.emit('paused', this.pausedReason);
  }
}

export class RawArchiveRecorder {
  private readonly writer: RawArchiveWriter;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private running = false;
  private connected = false;
  private readonly recentKeys = new Set<string>();

  constructor(writer = new RawArchiveWriter()) {
    this.writer = writer;
  }

  start() {
    if (!this.writer.isEnabled || this.running) return;
    this.running = true;
    this.connect();
  }

  async stop() {
    this.running = false;
    this.connected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    await this.writer.stop();
  }

  status() {
    return { ...this.writer.status(), connected: this.connected };
  }

  private connect() {
    if (!this.running) return;
    const url = new URL(process.env.RAW_ARCHIVE_JETSTREAM_URL ?? DEFAULT_JETSTREAM);
    url.searchParams.append('wantedCollections', 'app.bsky.feed.post');
    if (this.writer.resumeCursor) url.searchParams.set('cursor', this.writer.resumeCursor);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      this.connected = true;
      console.log(`[RawArchive] Connected; retention=${this.writer.status().retentionHours}h quota=${this.writer.status().maxBytes} bytes`);
    });
    ws.on('message', data => this.handleMessage(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)));
    ws.on('error', error => console.error('[RawArchive] WebSocket error:', error.message));
    ws.on('close', () => {
      this.connected = false;
      this.ws = null;
      if (this.running) this.reconnectTimer = setTimeout(() => this.connect(), 5_000);
    });
  }

  private handleMessage(data: Buffer) {
    if (!this.running) return;
    try {
      const message = JSON.parse(data.toString()) as Record<string, any>;
      const details = archiveEventDetails(message);
      if (!details) return;
      const { cursor, eventKey } = details;
      if (cursor === this.writer.resumeCursor && eventKey === this.writer.resumeEventKey) return;
      if (this.recentKeys.has(eventKey)) return;
      this.recentKeys.add(eventKey);
      if (this.recentKeys.size > 100_000) {
        const oldest = this.recentKeys.values().next().value;
        if (oldest) this.recentKeys.delete(oldest);
      }
      this.writer.record(data, cursor, eventKey);
    } catch (error) {
      console.error('[RawArchive] Invalid Jetstream event:', error instanceof Error ? error.message : error);
    }
  }
}

let recorder: RawArchiveRecorder | null = null;

export function getRawArchiveRecorder() {
  recorder ??= new RawArchiveRecorder();
  return recorder;
}
