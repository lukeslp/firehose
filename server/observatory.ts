import fs from "node:fs";
import path from "node:path";
import type { ObservatoryStatus } from "../shared/accessibility";

type DailyMetric = {
  date: string;
  coverage_state: "complete" | "partial" | "gapped";
  observed_minutes: number;
  first_cursor: string | null;
  last_cursor: string | null;
  post_total: number;
  image_posts: number;
  images: number;
  images_with_alt: number;
  fully_described_image_posts: number;
  alt_characters: number;
  alt_words: number;
  alt_descriptions: number;
  len_1_25: number;
  len_26_75: number;
  len_76_150: number;
  len_151_300: number;
  len_301_plus: number;
  image_alt_rate: number | null;
  fully_described_post_rate: number | null;
  collector_git_sha: string;
};

type DailyLanguageMetric = DailyMetric & { language: string };
type LanguageAggregate = Pick<
  DailyMetric,
  | "post_total"
  | "image_posts"
  | "images"
  | "images_with_alt"
  | "fully_described_image_posts"
  | "alt_characters"
  | "alt_words"
  | "alt_descriptions"
  | "len_1_25"
  | "len_26_75"
  | "len_76_150"
  | "len_151_300"
  | "len_301_plus"
> & { language: string };

type Snapshot = {
  generatedAt: string;
  dailyMetrics: DailyMetric[];
  dailyLanguageMetrics: DailyLanguageMetric[];
  sampleLengthDistribution: Record<string, number>;
  status: ObservatoryStatus;
};

const snapshotPath = () =>
  process.env.OBSERVATORY_SNAPSHOT_PATH ??
  "/home/coolhand/firehose-data/observatory/public-snapshot.json";

const EMPTY_STATUS: ObservatoryStatus = {
  state: "collecting",
  updatedAt: null,
  aggregateFreshnessAt: null,
  sampleFreshnessAt: null,
  firstCompleteDate: null,
  archiveFormatVersion: 2,
  samplingPaused: false,
  sampleUploadPaused: false,
  message: "The observatory is waiting for its first complete UTC day.",
};

const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const nullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const date = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : "1970-01-01";

function statusFrom(value: unknown): ObservatoryStatus {
  if (!value || typeof value !== "object") return EMPTY_STATUS;
  const status = value as Partial<ObservatoryStatus>;
  return {
    state: ["collecting", "partial", "ready", "paused", "error"].includes(
      String(status.state)
    )
      ? (status.state as ObservatoryStatus["state"])
      : EMPTY_STATUS.state,
    updatedAt: typeof status.updatedAt === "string" ? status.updatedAt : null,
    aggregateFreshnessAt:
      typeof status.aggregateFreshnessAt === "string"
        ? status.aggregateFreshnessAt
        : null,
    sampleFreshnessAt:
      typeof status.sampleFreshnessAt === "string"
        ? status.sampleFreshnessAt
        : null,
    firstCompleteDate:
      typeof status.firstCompleteDate === "string"
        ? status.firstCompleteDate
        : null,
    archiveFormatVersion:
      typeof status.archiveFormatVersion === "number" &&
      Number.isInteger(status.archiveFormatVersion)
        ? status.archiveFormatVersion
        : 2,
    samplingPaused: status.samplingPaused === true,
    sampleUploadPaused: status.sampleUploadPaused === true,
    message: typeof status.message === "string" ? status.message : null,
  };
}

function dailyFrom(value: unknown): DailyMetric | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const coverage = row.coverage_state;
  return {
    date: date(row.date),
    coverage_state:
      coverage === "complete" || coverage === "gapped" ? coverage : "partial",
    observed_minutes: number(row.observed_minutes),
    first_cursor:
      typeof row.first_cursor === "string" ? row.first_cursor : null,
    last_cursor: typeof row.last_cursor === "string" ? row.last_cursor : null,
    post_total: number(row.post_total),
    image_posts: number(row.image_posts),
    images: number(row.images),
    images_with_alt: number(row.images_with_alt),
    fully_described_image_posts: number(row.fully_described_image_posts),
    alt_characters: number(row.alt_characters),
    alt_words: number(row.alt_words),
    alt_descriptions: number(row.alt_descriptions),
    len_1_25: number(row.len_1_25),
    len_26_75: number(row.len_26_75),
    len_76_150: number(row.len_76_150),
    len_151_300: number(row.len_151_300),
    len_301_plus: number(row.len_301_plus),
    image_alt_rate: nullableNumber(row.image_alt_rate),
    fully_described_post_rate: nullableNumber(row.fully_described_post_rate),
    collector_git_sha:
      typeof row.collector_git_sha === "string"
        ? row.collector_git_sha
        : "unknown",
  };
}

function loadSnapshot(): Snapshot {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.resolve(snapshotPath()), "utf8")
    ) as Record<string, unknown>;
    const dailyMetrics = Array.isArray(raw.dailyMetrics)
      ? raw.dailyMetrics
          .map(dailyFrom)
          .filter((row): row is DailyMetric => row !== null)
      : [];
    const dailyLanguageMetrics = Array.isArray(raw.dailyLanguageMetrics)
      ? raw.dailyLanguageMetrics
          .map(value => {
            const metric = dailyFrom(value);
            const language =
              value &&
              typeof value === "object" &&
              typeof (value as Record<string, unknown>).language === "string"
                ? (value as Record<string, string>).language
                : "unknown";
            return metric ? { ...metric, language } : null;
          })
          .filter((row): row is DailyLanguageMetric => row !== null)
      : [];
    const length =
      raw.sampleLengthDistribution &&
      typeof raw.sampleLengthDistribution === "object"
        ? Object.fromEntries(
            Object.entries(
              raw.sampleLengthDistribution as Record<string, unknown>
            ).map(([key, value]) => [key, number(value)])
          )
        : {};
    return {
      generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
      dailyMetrics,
      dailyLanguageMetrics,
      sampleLengthDistribution: length,
      status: statusFrom(raw.status),
    };
  } catch {
    return {
      generatedAt: "",
      dailyMetrics: [],
      dailyLanguageMetrics: [],
      sampleLengthDistribution: {},
      status: EMPTY_STATUS,
    };
  }
}

export function observatoryDaily(days: number) {
  return loadSnapshot()
    .dailyMetrics.slice(-days)
    .map(({ first_cursor: _first, last_cursor: _last, ...row }) => row);
}

export function observatoryLanguages(days: number, top: number) {
  const snapshot = loadSnapshot();
  const rows = snapshot.dailyLanguageMetrics;
  const selectedDates = new Set(
    snapshot.dailyMetrics.slice(-days).map(row => row.date)
  );
  const grouped = new Map<string, LanguageAggregate>();
  for (const row of rows) {
    if (!selectedDates.has(row.date)) continue;
    const current = grouped.get(row.language) ?? {
      language: row.language,
      post_total: 0,
      image_posts: 0,
      images: 0,
      images_with_alt: 0,
      fully_described_image_posts: 0,
      alt_characters: 0,
      alt_words: 0,
      alt_descriptions: 0,
      len_1_25: 0,
      len_26_75: 0,
      len_76_150: 0,
      len_151_300: 0,
      len_301_plus: 0,
    };
    for (const field of [
      "post_total",
      "image_posts",
      "images",
      "images_with_alt",
      "fully_described_image_posts",
      "alt_characters",
      "alt_words",
      "alt_descriptions",
      "len_1_25",
      "len_26_75",
      "len_76_150",
      "len_151_300",
      "len_301_plus",
    ] as const)
      current[field] += row[field];
    grouped.set(row.language, current);
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.images - a.images || a.language.localeCompare(b.language))
    .slice(0, top)
    .map(row => ({
      ...row,
      image_alt_rate: row.images ? row.images_with_alt / row.images : null,
      fully_described_post_rate: row.image_posts
        ? row.fully_described_image_posts / row.image_posts
        : null,
    }));
}

export function observatoryStatus() {
  const snapshot = loadSnapshot();
  return {
    ...snapshot.status,
    sampleLengthDistribution: snapshot.sampleLengthDistribution,
  };
}
