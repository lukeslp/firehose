import { useEffect, useMemo, useState } from "react";
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
import {
  type AccessibilitySummary,
  safeMean,
  summarizeAccessibility,
} from "@/lib/accessibilityMetrics";

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
const decimal = (value: number | null) =>
  value == null
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const time = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value)) + " UTC"
    : "Waiting for first publication";

type HistoryWindow = 7 | 30 | 90;
type HistoryLens = "rates" | "counts" | "depth";
type HistoryRow = Daily & {
  coverage: string;
  imageAltPercent: number | null;
  completePercent: number | null;
  imagesMissingAlt: number;
  averageWords: number | null;
  averageCharacters: number | null;
};

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
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow>(30);
  const [historyLens, setHistoryLens] = useState<HistoryLens>("rates");
  const liveQuery = trpc.stats.accessibilityTimeline.useQuery(
    { minutes: 1440 },
    { refetchInterval: 60_000 }
  );
  const dailyQuery = trpc.stats.accessibilityDaily.useQuery(
    { days: 90 },
    { refetchInterval: 5 * 60_000 }
  );
  const languageQuery = trpc.stats.accessibilityLanguages.useQuery(
    { days: historyWindow, top: 12 },
    { refetchInterval: 5 * 60_000 }
  );
  const statusQuery = trpc.stats.observatoryStatus.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const daily = (dailyQuery.data ?? []) as Daily[];
  const last = daily.at(-1);
  const selectedDaily = daily.slice(-historyWindow);
  const selectedSummary = summarizeAccessibility(selectedDaily);
  const completeDaily = daily.filter(row => row.coverage_state === "complete");
  const recent30 = summarizeAccessibility(completeDaily.slice(-30));
  const previous30 = summarizeAccessibility(completeDaily.slice(-60, -30));
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
  const aggregateBins = [
    { label: "1–25", count: selectedSummary.lengthBins.len_1_25 },
    { label: "26–75", count: selectedSummary.lengthBins.len_26_75 },
    { label: "76–150", count: selectedSummary.lengthBins.len_76_150 },
    { label: "151–300", count: selectedSummary.lengthBins.len_151_300 },
    { label: "301+", count: selectedSummary.lengthBins.len_301_plus },
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
  const historyRows = selectedDaily.map(row => ({
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
    imagesMissingAlt: Math.max(0, row.images - row.images_with_alt),
    averageWords: safeMean(row.alt_words, row.alt_descriptions),
    averageCharacters: safeMean(row.alt_characters, row.alt_descriptions),
  }));
  const observedMinuteBuckets = liveQuery.data?.length ?? 0;
  const hasDailyTrend = historyRows.length > 0;
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
                status?.hasPublishedAggregates
                  ? "Published"
                  : status?.state === "paused"
                    ? "Paused"
                    : "Awaiting publication"
              }
              detail={
                status?.hasPublishedAggregates
                  ? time(status.aggregateFreshnessAt)
                  : "Waiting for first publication"
              }
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
          aria-labelledby="history-controls-title"
          className="mt-10 border-y border-border bg-card px-4 py-5 sm:px-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 id="history-controls-title" className="text-section-title">
                Explore published history
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                These controls affect the daily aggregates and declared-language
                table below. The rolling 24-hour cards above remain live.
              </p>
            </div>
            <p
              className="text-sm font-semibold tabular-nums"
              aria-live="polite"
            >
              {historyRows.length} observed{" "}
              {historyRows.length === 1 ? "date" : "dates"}
              {historyRows.length < historyWindow
                ? ` available in the ${historyWindow}-day window`
                : " shown"}
            </p>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <ChoiceGroup
              legend="Time window"
              name="history-window"
              value={String(historyWindow)}
              options={[
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
              onChange={value =>
                setHistoryWindow(Number(value) as HistoryWindow)
              }
            />
            <ChoiceGroup
              legend="Daily chart view"
              name="history-lens"
              value={historyLens}
              options={[
                { value: "rates", label: "Rates" },
                { value: "counts", label: "Counts" },
                { value: "depth", label: "Description depth" },
              ]}
              onChange={value => setHistoryLens(value as HistoryLens)}
            />
          </div>
        </section>

        <section
          aria-labelledby="daily-trends-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="daily-trends-title" className="text-section-title">
            Daily published record · {historyWindow} days
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Exact counts and written coverage states are shown below the chart.
            Partial and gapped days should not be compared as full days.
          </p>
          <HistorySummary lens={historyLens} summary={selectedSummary} />
          {hasDailyTrend ? (
            <DailyHistoryChart rows={historyRows} lens={historyLens} />
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
              Show exact daily evidence table
            </summary>
            <div
              className="mt-3 overflow-x-auto"
              role="region"
              aria-label="Daily accessibility evidence"
              tabIndex={0}
            >
              <table className="w-full text-left text-sm">
                <caption className="mb-2 text-left text-xs text-muted-foreground">
                  Daily published aggregates with exact denominators and
                  description-depth measures.
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
                    <th scope="col" className="p-2 text-right">
                      Missing alt
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Mean words / alt
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Mean chars / alt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map(row => (
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
                      <td className="p-2 text-right tabular-nums">
                        {whole(row.imagesMissingAlt)}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {decimal(row.averageWords)}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {decimal(row.averageCharacters)}
                      </td>
                    </tr>
                  ))}
                  {!historyRows.length && (
                    <tr>
                      <td colSpan={8} className="p-3 text-muted-foreground">
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
                  data={historyRows}
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
            Selected {historyWindow}-day window:{" "}
            {whole(selectedSummary.imagesWithAlt)} of{" "}
            {whole(selectedSummary.images)} images had non-empty alt (
            {percent(
              rate(selectedSummary.imagesWithAlt, selectedSummary.images)
            )}
            ).
          </p>
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer font-semibold">
              Show exact daily volume table
            </summary>
            <div
              className="mt-3 overflow-x-auto"
              role="region"
              aria-label="Daily image volume"
              tabIndex={0}
            >
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
                  {historyRows.map(row => (
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
                  {!historyRows.length && (
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
          aria-labelledby="depth-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="depth-title" className="text-section-title">
            Description depth · {historyWindow} days
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            These exact aggregates cover every observed non-empty image
            description in the selected window. Length shows how much was
            written, not whether a description was useful or accurate.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Non-empty descriptions"
              value={whole(selectedSummary.altDescriptions)}
              detail={`${whole(selectedSummary.altWords)} words across all observed alternatives`}
            />
            <Metric
              label="Mean words / description"
              value={decimal(
                safeMean(
                  selectedSummary.altWords,
                  selectedSummary.altDescriptions
                )
              )}
              detail="Whitespace-delimited words in non-empty alternatives"
            />
            <Metric
              label="Mean characters / description"
              value={decimal(
                safeMean(
                  selectedSummary.altCharacters,
                  selectedSummary.altDescriptions
                )
              )}
              detail="Characters after trimming surrounding whitespace"
            />
            <Metric
              label="Images missing alt"
              value={whole(selectedSummary.imagesMissingAlt)}
              detail={`${percent(rate(selectedSummary.imagesMissingAlt, selectedSummary.images))} of observed images`}
            />
          </div>
          {selectedSummary.altDescriptions ? (
            <div
              className="mt-4"
              role="img"
              aria-label={`Bar chart showing ${whole(selectedSummary.altDescriptions)} observed descriptions in five character-length bands for the selected ${historyWindow}-day window`}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aggregateBins}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.75} />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} width={58} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Observed descriptions"
                    fill="var(--bsky-blue)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p
              role="status"
              className="mt-4 rounded-md border border-border bg-muted p-4 text-sm"
            >
              No non-empty image descriptions are available in this window.
            </p>
          )}
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer font-semibold">
              Show exact description-length table
            </summary>
            <table className="mt-3 w-full text-left text-sm">
              <caption className="mb-2 text-left text-xs text-muted-foreground">
                All observed non-empty descriptions by trimmed character length.
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2">
                    Characters
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Descriptions
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {aggregateBins.map(bin => (
                  <tr key={bin.label} className="border-b border-border">
                    <th scope="row" className="p-2 font-medium">
                      {bin.label}
                    </th>
                    <td className="p-2 text-right tabular-nums">
                      {whole(bin.count)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {percent(
                        rate(bin.count, selectedSummary.altDescriptions)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <aside className="mt-4 border-l-4 border-border bg-muted p-4 text-sm">
            <h3 className="font-semibold">Accessibility terms · planned</h3>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              Mentions such as “alt text,” “screen reader,” or “captions” are
              not in today’s public aggregates. A future release will use a
              versioned literal-term taxonomy and publish only
              privacy-suppressed counts after the retained v2 archive is
              replayed; unavailable dates will remain unavailable rather than
              estimated.
            </p>
          </aside>
        </section>

        <section
          aria-labelledby="languages-title"
          className="mt-10 border-t border-border pt-6"
        >
          <h2 id="languages-title" className="text-section-title">
            Declared-language detail · {historyWindow} days
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Languages are the post author’s declared primary BCP-47 tag,
            normalized to its primary subtag. <code>unknown</code> means no
            usable declaration; it is not model-inferred.
          </p>
          <div
            className="mt-4 overflow-x-auto"
            role="region"
            aria-label="Declared-language accessibility detail"
            tabIndex={0}
          >
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
                    Mean words / alt
                  </th>
                  <th scope="col" className="p-2 text-right">
                    Mean chars / alt
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
                      {whole(row.images_with_alt)} ·{" "}
                      {percent(row.image_alt_rate)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {decimal(safeMean(row.alt_words, row.alt_descriptions))}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {decimal(
                        safeMean(row.alt_characters, row.alt_descriptions)
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {whole(row.fully_described_image_posts)} ·{" "}
                      {percent(row.fully_described_post_rate)}
                    </td>
                  </tr>
                ))}
                {!languageQuery.data?.length && (
                  <tr>
                    <td colSpan={6} className="p-3 text-muted-foreground">
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
            {status?.hasPublishedAggregates ? (
              <p>
                <a
                  href="https://huggingface.co/datasets/lukeslp/bluesky-alt-text-observatory"
                  onClick={goatEvent}
                  className="font-semibold text-accent underline underline-offset-4"
                >
                  Download Parquet data and read the full methodology on Hugging
                  Face
                </a>
                .
              </p>
            ) : (
              <p role="status">
                Parquet downloads and the full dataset documentation will be
                linked here after aggregate publication is confirmed.
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

function ChoiceGroup({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-stat-label text-muted-foreground">
        {legend}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(option => (
          <label key={option.value} className="cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="flex min-h-11 items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function HistorySummary({
  lens,
  summary,
}: {
  lens: HistoryLens;
  summary: AccessibilitySummary;
}) {
  const metrics =
    lens === "rates"
      ? [
          {
            label: "Images with alt",
            value: percent(rate(summary.imagesWithAlt, summary.images)),
            detail: `${whole(summary.imagesWithAlt)} of ${whole(summary.images)} images`,
          },
          {
            label: "Fully described posts",
            value: percent(rate(summary.fullyDescribed, summary.imagePosts)),
            detail: `${whole(summary.fullyDescribed)} of ${whole(summary.imagePosts)} image posts`,
          },
          {
            label: "Missing alt",
            value: percent(rate(summary.imagesMissingAlt, summary.images)),
            detail: `${whole(summary.imagesMissingAlt)} observed images`,
          },
          {
            label: "Observed image posts",
            value: whole(summary.imagePosts),
            detail: `${whole(summary.postTotal)} posts of all content types`,
          },
        ]
      : lens === "counts"
        ? [
            {
              label: "All posts",
              value: whole(summary.postTotal),
              detail: "Observed create events",
            },
            {
              label: "Image posts",
              value: whole(summary.imagePosts),
              detail: "Posts containing one or more images",
            },
            {
              label: "Images",
              value: whole(summary.images),
              detail: `${whole(summary.imagesWithAlt)} with non-empty alt`,
            },
            {
              label: "Missing alt",
              value: whole(summary.imagesMissingAlt),
              detail: "Derived from the exact image denominator",
            },
          ]
        : [
            {
              label: "Descriptions",
              value: whole(summary.altDescriptions),
              detail: "Observed non-empty alternatives",
            },
            {
              label: "Words",
              value: whole(summary.altWords),
              detail: `${decimal(safeMean(summary.altWords, summary.altDescriptions))} mean per description`,
            },
            {
              label: "Characters",
              value: whole(summary.altCharacters),
              detail: `${decimal(safeMean(summary.altCharacters, summary.altDescriptions))} mean per description`,
            },
            {
              label: "301+ characters",
              value: whole(summary.lengthBins.len_301_plus),
              detail: percent(
                rate(summary.lengthBins.len_301_plus, summary.altDescriptions)
              ),
            },
          ];

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(metric => (
        <Metric key={metric.label} {...metric} />
      ))}
    </div>
  );
}

function DailyHistoryChart({
  rows,
  lens,
}: {
  rows: HistoryRow[];
  lens: HistoryLens;
}) {
  if (lens === "counts") {
    return (
      <div
        className="mt-4"
        role="img"
        aria-label="Stacked bar chart showing daily images with non-empty alt and images missing alt"
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={rows}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.75} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
            <YAxis tick={{ fontSize: 11 }} width={58} />
            <Tooltip />
            <Bar
              dataKey="images_with_alt"
              name="Images with alt"
              stackId="images"
              fill="var(--bsky-blue)"
              isAnimationActive={false}
            />
            <Bar
              dataKey="imagesMissingAlt"
              name="Images missing alt"
              stackId="images"
              fill="var(--sentiment-neutral)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (lens === "depth") {
    return (
      <div
        className="mt-4"
        role="img"
        aria-label="Line chart showing the daily mean word count of non-empty image descriptions"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={rows}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.75} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
            <YAxis tick={{ fontSize: 11 }} width={48} />
            <Tooltip />
            <Line
              type="linear"
              dataKey="averageWords"
              name="Mean words per description"
              stroke="var(--bsky-blue)"
              strokeWidth={3}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div
      className="mt-4"
      role="img"
      aria-label="Line chart showing daily image alternative-text coverage and fully-described image-post rate"
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={rows}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.75} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={36} />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={{ fontSize: 11 }}
            width={48}
          />
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
          <Line
            type="linear"
            dataKey="imageAltPercent"
            name="Images with alt"
            stroke="var(--bsky-blue)"
            strokeWidth={3}
            dot={{ r: 2 }}
            connectNulls={false}
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
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
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
