import { useEffect, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";

type Daily = {
  date: string;
  coverage_state: "complete" | "partial" | "gapped";
  observed_minutes: number;
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

const rate = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : null;
const percent = (value: number | null) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;
const whole = (value: number) => value.toLocaleString();
const time = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value)) + " UTC"
    : "Waiting for first publication";

function total(rows: Daily[]) {
  return rows.reduce(
    (result, row) => ({
      images: result.images + row.images,
      imagesWithAlt: result.imagesWithAlt + row.images_with_alt,
      imagePosts: result.imagePosts + row.image_posts,
      fullyDescribed: result.fullyDescribed + row.fully_described_image_posts,
    }),
    { images: 0, imagesWithAlt: 0, imagePosts: 0, fullyDescribed: 0 }
  );
}

function goatEvent() {
  const counter = (
    window as Window & {
      goatcounter?: {
        count?: (event: { path: string; event: boolean }) => void;
      };
    }
  ).goatcounter;
  counter?.count?.({
    path: "/bluesky/firehose/accessibility/huggingface",
    event: true,
  });
}

export default function AccessibilityObservatory() {
  const liveQuery = trpc.stats.accessibilityTimeline.useQuery(
    { minutes: 1440 },
    { refetchInterval: 60_000 }
  );
  const dailyQuery = trpc.stats.accessibilityDaily.useQuery(
    { days: 90 },
    { refetchInterval: 5 * 60_000 }
  );
  const languageQuery = trpc.stats.accessibilityLanguages.useQuery(
    { days: 30, top: 12 },
    { refetchInterval: 5 * 60_000 }
  );
  const statusQuery = trpc.stats.observatoryStatus.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const daily = (dailyQuery.data ?? []) as Daily[];
  const last = daily.at(-1);
  const trailing = total(daily.slice(-30));
  const completeDaily = daily.filter(row => row.coverage_state === "complete");
  const recent30 = total(completeDaily.slice(-30));
  const previous30 = total(completeDaily.slice(-60, -30));
  const delta =
    rate(recent30.imagesWithAlt, recent30.images) == null ||
    rate(previous30.imagesWithAlt, previous30.images) == null
      ? null
      : rate(recent30.imagesWithAlt, recent30.images)! -
        rate(previous30.imagesWithAlt, previous30.images)!;
  const current24 = useMemo(
    () =>
      (liveQuery.data ?? []).reduce(
        (result, row) => ({
          images: result.images + row.images,
          imagesWithAlt: result.imagesWithAlt + row.imagesWithAlt,
          imagePosts: result.imagePosts + row.imagePosts,
          fullyDescribed: result.fullyDescribed + row.fullyDescribedImagePosts,
        }),
        { images: 0, imagesWithAlt: 0, imagePosts: 0, fullyDescribed: 0 }
      ),
    [liveQuery.data]
  );
  const status = statusQuery.data;
  const distribution = status?.sampleLengthDistribution ?? {};
  const bins = [
    { label: "1–25", count: distribution.len_1_25 ?? 0 },
    { label: "26–75", count: distribution.len_26_75 ?? 0 },
    { label: "76–150", count: distribution.len_76_150 ?? 0 },
    { label: "151–300", count: distribution.len_151_300 ?? 0 },
    { label: "301+", count: distribution.len_301_plus ?? 0 },
  ];
  const loading =
    liveQuery.isLoading ||
    dailyQuery.isLoading ||
    languageQuery.isLoading ||
    statusQuery.isLoading;
  const error =
    liveQuery.isError ||
    dailyQuery.isError ||
    languageQuery.isError ||
    statusQuery.isError;
  const shortDaily = daily.slice(-30).map(row => ({
    ...row,
    coverage:
      row.coverage_state === "complete"
        ? "Complete"
        : row.coverage_state === "gapped"
          ? "Gapped"
          : "Partial",
    imageAltPercent:
      row.image_alt_rate == null ? null : row.image_alt_rate * 100,
    completePercent:
      row.fully_described_post_rate == null
        ? null
        : row.fully_described_post_rate * 100,
  }));
  const observedMinuteBuckets = liveQuery.data?.length ?? 0;
  const hasDailyTrend = shortDaily.length > 0;
  const hasReleasedSample = bins.some(bin => bin.count > 0);

  useEffect(() => {
    const previous = document.title;
    document.title = "Bluesky Accessibility Observatory";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#observatory-main"
        className="sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:not-sr-only focus:rounded-md focus:bg-background focus:px-4 focus:py-3 focus:font-semibold focus:text-foreground focus:shadow-lg"
      >
        Skip to observatory content
      </a>
      <header className="border-b-2 border-foreground px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-stat-label text-muted-foreground">
              Bluesky Firehose · accessibility
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
              Accessibility Observatory
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
              Is image-description coverage improving, for whom, and how
              reliable is this reading?
            </p>
          </div>
          <a
            href="/bluesky/firehose/"
            className="min-h-11 rounded-md border border-border px-4 py-3 text-sm font-semibold hover:bg-muted"
          >
            Live firehose
          </a>
        </div>
      </header>

      <main
        id="observatory-main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
      >
        {loading && (
          <p
            role="status"
            className="rounded-md border border-border bg-muted p-4 text-sm"
          >
            Loading the latest published aggregate snapshot…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive p-4 text-sm"
          >
            The observatory data could not be loaded. The live firehose remains
            separate and unaffected; please try again shortly.
          </p>
        )}
        {status?.message && (
          <p
            role="status"
            className="mt-4 rounded-md border border-border bg-muted p-4 text-sm"
          >
            {status.message}
          </p>
        )}

        <section aria-labelledby="reading-title" className="mt-6">
          <h2 id="reading-title" className="text-section-title">
            Current reading
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Image coverage · rolling 24h"
              value={percent(rate(current24.imagesWithAlt, current24.images))}
              detail={
                current24.images
                  ? `${whole(current24.imagesWithAlt)} of ${whole(current24.images)} images across ${whole(observedMinuteBuckets)} observed minute buckets`
                  : "No observed image posts yet"
              }
            />
            <Metric
              label="Fully described posts · rolling 24h"
              value={percent(
                rate(current24.fullyDescribed, current24.imagePosts)
              )}
              detail={
                current24.imagePosts
                  ? `${whole(current24.fullyDescribed)} of ${whole(current24.imagePosts)} image posts across ${whole(observedMinuteBuckets)} observed minute buckets`
                  : "No observed image posts yet"
              }
            />
            <Metric
              label="30-day coverage change"
              value={
                delta == null
                  ? "—"
                  : `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)} pp`
              }
              detail="Most recent 30 complete days versus the preceding 30"
            />
            <Metric
              label="Aggregate freshness"
              value={
                status?.state === "ready"
                  ? "Published"
                  : status?.state === "paused"
                    ? "Paused"
                    : "Partial"
              }
              detail={time(status?.aggregateFreshnessAt)}
            />
          </div>
          {last && last.coverage_state !== "complete" && (
            <p className="mt-3 text-sm text-muted-foreground">
              <strong>Coverage warning:</strong> {last.date} is{" "}
              {last.coverage_state}; it has {whole(last.observed_minutes)}{" "}
              observed minutes and should not be compared as a full day.
            </p>
          )}
        </section>

        <section
          aria-labelledby="daily-trends-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="daily-trends-title" className="text-section-title">
            Daily image-description coverage
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Exact counts and written coverage states are shown below the chart.
            Partial and gapped days should not be compared as full days.
          </p>
          {hasDailyTrend ? (
            <div
              className="mt-4"
              role="img"
              aria-label="Line chart showing daily image alternative-text coverage and fully-described image-post rate for the last 30 days"
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={shortDaily}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.75} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    minTickGap={36}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11 }}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                  />
                  <Line
                    type="linear"
                    dataKey="imageAltPercent"
                    name="Images with alt"
                    stroke="var(--bsky-blue)"
                    strokeWidth={3}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="linear"
                    dataKey="completePercent"
                    name="Fully described posts"
                    stroke="var(--sentiment-positive)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p
              role="status"
              className="mt-4 rounded-md border border-border bg-muted p-4 text-sm"
            >
              The daily trend will appear after the first observed UTC day is
              available.
            </p>
          )}
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer font-semibold">
              Show exact daily coverage table
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-2 text-left text-xs text-muted-foreground">
                  Daily observed image coverage. Rates use exact image and
                  image-post denominators.
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="p-2">
                      UTC date
                    </th>
                    <th scope="col" className="p-2">
                      Coverage
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Images with alt
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Fully described posts
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Image posts
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shortDaily.map(row => (
                    <tr key={row.date} className="border-b border-border">
                      <th scope="row" className="p-2 font-medium">
                        {row.date}
                      </th>
                      <td className="p-2">
                        {row.coverage}{" "}
                        <span className="text-muted-foreground">
                          ({row.observed_minutes}m)
                        </span>
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {whole(row.images_with_alt)} of {whole(row.images)} ·{" "}
                        {percent(row.image_alt_rate)}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {whole(row.fully_described_image_posts)} ·{" "}
                        {percent(row.fully_described_post_rate)}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {whole(row.image_posts)}
                      </td>
                    </tr>
                  ))}
                  {!shortDaily.length && (
                    <tr>
                      <td colSpan={5} className="p-3 text-muted-foreground">
                        No daily aggregate rows are available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section
          aria-labelledby="volume-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="volume-title" className="text-section-title">
            Observed image volume
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Coverage rates are only meaningful alongside the number of images
            observed.
          </p>
          {hasDailyTrend ? (
            <div
              className="mt-4"
              role="img"
              aria-label="Bar chart showing observed images and image posts per day"
            >
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={shortDaily}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.75} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    minTickGap={36}
                  />
                  <YAxis tick={{ fontSize: 11 }} width={52} />
                  <Tooltip />
                  <Bar
                    dataKey="images"
                    name="Images"
                    fill="var(--bsky-blue)"
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="image_posts"
                    name="Image posts"
                    fill="var(--sentiment-neutral)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-border bg-muted p-4 text-sm">
              Daily volume will appear with the first aggregate row.
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Last 30 days: {whole(trailing.imagesWithAlt)} of{" "}
            {whole(trailing.images)} images had non-empty alt (
            {percent(rate(trailing.imagesWithAlt, trailing.images))}).
          </p>
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer font-semibold">
              Show exact daily volume table
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-2 text-left text-xs text-muted-foreground">
                  Observed daily image and image-post volume.
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="p-2">
                      UTC date
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Images
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Image posts
                    </th>
                    <th scope="col" className="p-2">
                      Coverage state
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shortDaily.map(row => (
                    <tr key={row.date} className="border-b border-border">
                      <th scope="row" className="p-2 font-medium">
                        {row.date}
                      </th>
                      <td className="p-2 text-right tabular-nums">
                        {whole(row.images)}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {whole(row.image_posts)}
                      </td>
                      <td className="p-2">{row.coverage}</td>
                    </tr>
                  ))}
                  {!shortDaily.length && (
                    <tr>
                      <td colSpan={4} className="p-3 text-muted-foreground">
                        No daily volume rows are available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section
          aria-labelledby="languages-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="languages-title" className="text-section-title">
            Declared-language coverage · last 30 days
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Languages are the post author’s declared primary BCP-47 tag,
            normalized to its primary subtag. <code>unknown</code> means no
            usable declaration; it is not model-inferred.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left text-xs text-muted-foreground">
                Languages with the most observed images; sorted by image
                denominator.
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2">
                    Declared language
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Images
                  </th>
                  <th scope="col" className="p-2 text-right">
                    With alt
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Fully described posts
                  </th>
                </tr>
              </thead>
              <tbody>
                {(languageQuery.data ?? []).map(row => (
                  <tr key={row.language} className="border-b border-border">
                    <th scope="row" className="p-2 font-medium">
                      {row.language}
                    </th>
                    <td className="p-2 text-right tabular-nums">
                      {whole(row.images)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {percent(row.image_alt_rate)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {percent(row.fully_described_post_rate)}
                    </td>
                  </tr>
                ))}
                {!languageQuery.data?.length && (
                  <tr>
                    <td colSpan={4} className="p-3 text-muted-foreground">
                      No declared-language aggregate rows are available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="sample-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="sample-title" className="text-section-title">
            Sampled description length
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            This distribution is from the released deterministic sample, not
            every description. Rows are released after a 48-hour correction
            window; it describes length, not quality.
          </p>
          {hasReleasedSample ? (
            <div
              className="mt-4"
              role="img"
              aria-label="Bar chart showing the number of sampled image descriptions in fixed character-length bins"
            >
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={bins}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.75} />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} width={45} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Sampled descriptions"
                    fill="var(--sentiment-positive)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-border bg-muted p-4 text-sm">
              No description sample has been released; the first eligible rows
              require the full correction window.
            </p>
          )}
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer font-semibold">
              Show sampled length table
            </summary>
            <table className="mt-3 w-full text-left text-sm">
              <caption className="mb-2 text-left text-xs text-muted-foreground">
                Published sample rows by trimmed description length.
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2">
                    Characters
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Sampled descriptions
                  </th>
                </tr>
              </thead>
              <tbody>
                {bins.map(bin => (
                  <tr key={bin.label} className="border-b border-border">
                    <th scope="row" className="p-2 font-medium">
                      {bin.label}
                    </th>
                    <td className="p-2 text-right tabular-nums">
                      {whole(bin.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section
          aria-labelledby="methods-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="methods-title" className="text-section-title">
            How to read this
          </h2>
          <div className="mt-3 max-w-4xl space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Whitespace-only alternatives count as missing. A multi-image post
              is fully described only when every image has non-empty alt.
              Aggregates measure behavior at creation time, so they are not
              revised after a deletion.
            </p>
            <p>
              The archive receives at-least-once Jetstream v1 events and has no
              sync marker. It folds post deletion and inactive-account markers
              idempotently for the released description sample, but this remains
              an observed stream, not a perfect current-state census. Partial
              and gapped days are visibly labeled.
            </p>
            <p>
              Public data excludes post text, image bytes and URLs, CIDs, raw
              records, DIDs, and handles. Pseudonyms are keyed, not anonymous.
              Aggregate fields/schema may be reused under CC0; sampled
              descriptions retain their authors’ rights.
            </p>
            {status?.firstCompleteDate ? (
              <p>
                <a
                  href="https://huggingface.co/datasets/lukeslp/bluesky-alt-text-observatory"
                  onClick={goatEvent}
                  className="font-semibold text-accent underline underline-offset-4"
                >
                  Download Parquet data and read the full methodology on
                  Hugging Face
                </a>
                .
              </p>
            ) : (
              <p role="status">
                Parquet downloads and the full dataset documentation will be
                linked here after the first complete UTC day is published.
              </p>
            )}
          </div>
        </section>
      </main>
      <footer className="flex flex-wrap justify-end gap-3 border-t-2 border-foreground px-4 py-4 text-xs font-semibold sm:px-6">
        <a
          className="min-h-11 border border-border px-7 py-3 hover:bg-muted"
          href="https://lukesteuber.com"
        >
          lukesteuber.com
        </a>
        <a
          className="min-h-11 border border-border px-7 py-3 hover:bg-muted"
          href="https://datapoems.io"
        >
          datapoems.io
        </a>
      </footer>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="border border-border bg-card p-4">
      <h3 className="text-stat-label text-muted-foreground">{label}</h3>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </article>
  );
}
