import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "firehose-observatory-"));
const snapshot = path.join(root, "public-snapshot.json");

describe("public observatory snapshot boundary", () => {
  let observatory: typeof import("./observatory");

  beforeAll(async () => {
    process.env.OBSERVATORY_SNAPSHOT_PATH = snapshot;
    fs.writeFileSync(
      snapshot,
      JSON.stringify({
        generatedAt: "2026-09-02T00:00:00Z",
        dailyMetrics: [
          {
            date: "2026-09-01",
            coverage_state: "complete",
            observed_minutes: 1440,
            first_cursor: "secret-cursor-one",
            last_cursor: "secret-cursor-two",
            post_total: 10,
            image_posts: 2,
            images: 3,
            images_with_alt: 2,
            fully_described_image_posts: 1,
            alt_characters: 20,
            alt_words: 4,
            alt_descriptions: 2,
            len_1_25: 2,
            len_26_75: 0,
            len_76_150: 0,
            len_151_300: 0,
            len_301_plus: 0,
            image_alt_rate: 2 / 3,
            fully_described_post_rate: 0.5,
            collector_git_sha: "abc123",
          },
        ],
        dailyLanguageMetrics: [
          {
            date: "2026-09-01",
            language: "en",
            post_total: 10,
            image_posts: 2,
            images: 3,
            images_with_alt: 2,
            fully_described_image_posts: 1,
            alt_characters: 20,
            alt_words: 4,
            alt_descriptions: 2,
            len_1_25: 2,
            len_26_75: 0,
            len_76_150: 0,
            len_151_300: 0,
            len_301_plus: 0,
          },
        ],
        sampleLengthDistribution: { len_1_25: 2 },
        status: {
          state: "ready",
          updatedAt: "2026-09-02T00:00:00Z",
          aggregateFreshnessAt: "2026-09-02T00:00:00Z",
          sampleFreshnessAt: null,
          firstCompleteDate: "2026-09-01",
          archiveFormatVersion: 2,
          samplingPaused: false,
          sampleUploadPaused: false,
          message: null,
        },
        prohibitedSampleText: "must never leave the snapshot reader",
      })
    );
    observatory = await import("./observatory");
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("returns aggregate rows without cursor bounds or sample text", () => {
    const daily = observatory.observatoryDaily(30);
    expect(daily).toHaveLength(1);
    expect(JSON.stringify(daily)).not.toContain("secret-cursor");
    expect(JSON.stringify(daily)).not.toContain("must never leave");
    expect(daily[0]).toMatchObject({ images: 3, images_with_alt: 2 });
  });

  it("returns normalized aggregate language totals and redacted status", () => {
    expect(observatory.observatoryLanguages(30, 10)[0]).toMatchObject({
      language: "en",
      images: 3,
      image_alt_rate: 2 / 3,
    });
    expect(observatory.observatoryStatus()).toMatchObject({
      state: "ready",
      archiveFormatVersion: 2,
      sampleLengthDistribution: { len_1_25: 2 },
    });
    expect(JSON.stringify(observatory.observatoryStatus())).not.toContain(
      "must never leave"
    );
  });
});
