import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join('/tmp', `firehose-test-${process.pid}.db`);

describe('minute history', () => {
  let db: typeof import('./db');

  beforeAll(async () => {
    process.env.DATABASE_URL = dbPath;
    db = await import('./db');
  });

  afterAll(() => {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(`${dbPath}${suffix}`); } catch {}
    }
  });

  it('creates, updates, and reads minute aggregates', async () => {
    const minute = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    await db.upsertMinuteBucket(minute, { total: 10, positive: 3, neutral: 5, negative: 2 });
    await db.upsertMinuteBucket(minute, { total: 12, positive: 4, neutral: 6, negative: 2 });
    await db.upsertMinuteBucketsByLanguage(minute, new Map([
      ['en', { total: 8, positive: 3, neutral: 4, negative: 1 }],
    ]));
    await db.upsertMinuteBucketsByContentType(minute, new Map([['text', 9], ['image', 3]]));

    const timeline = await db.getMinuteTimeline(5);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ postsCount: 12, positiveCount: 4 });
    expect((await db.getMinuteTimelineByLanguage(5, 5))[0]).toMatchObject({ language: 'en' });
    expect(await db.getMinuteTimelineByContentType(5)).toHaveLength(2);
    expect((await db.getMinuteCoverage()).bucketCount).toBe(1);
  });
});
