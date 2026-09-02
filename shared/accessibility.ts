/**
 * Small, dependency-free helpers shared by the live pulse and observatory
 * tooling. These deliberately inspect the AT record, not the rendered media:
 * a failed CDN lookup must not change an accessibility observation.
 */
export interface AccessibilityCounts {
  imagePosts: number;
  images: number;
  imagesWithAlt: number;
  fullyDescribedImagePosts: number;
  altCharacters: number;
  altWords: number;
}

export interface AccessibilityPoint extends AccessibilityCounts {
  minuteTimestamp: Date;
}

export interface ImageDescription {
  alt: string;
  imagePosition: number;
  imageCount: number;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  orientation: "landscape" | "portrait" | "square" | "unknown";
  embedKind: "images" | "recordWithMedia";
}

export interface ObservatoryStatus {
  state: "collecting" | "partial" | "ready" | "paused" | "error";
  updatedAt: string | null;
  aggregateFreshnessAt: string | null;
  sampleFreshnessAt: string | null;
  firstCompleteDate: string | null;
  archiveFormatVersion: number;
  samplingPaused: boolean;
  sampleUploadPaused: boolean;
  message: string | null;
}

export const emptyAccessibilityCounts = (): AccessibilityCounts => ({
  imagePosts: 0,
  images: 0,
  imagesWithAlt: 0,
  fullyDescribedImagePosts: 0,
  altCharacters: 0,
  altWords: 0,
});

export function addAccessibilityCounts(
  target: AccessibilityCounts,
  next: AccessibilityCounts
): AccessibilityCounts {
  target.imagePosts += next.imagePosts;
  target.images += next.images;
  target.imagesWithAlt += next.imagesWithAlt;
  target.fullyDescribedImagePosts += next.fullyDescribedImagePosts;
  target.altCharacters += next.altCharacters;
  target.altWords += next.altWords;
  return target;
}

function imageEmbed(
  record: unknown
): { images: unknown[]; embedKind: ImageDescription["embedKind"] } | null {
  if (!record || typeof record !== "object") return null;
  const embed = (record as { embed?: unknown }).embed;
  if (!embed || typeof embed !== "object") return null;
  const typedEmbed = embed as {
    $type?: unknown;
    images?: unknown[];
    media?: unknown;
  };
  if (
    typedEmbed.$type === "app.bsky.embed.images" &&
    Array.isArray(typedEmbed.images)
  ) {
    return { images: typedEmbed.images, embedKind: "images" };
  }
  if (
    typedEmbed.$type === "app.bsky.embed.recordWithMedia" &&
    typedEmbed.media &&
    typeof typedEmbed.media === "object"
  ) {
    const media = typedEmbed.media as { $type?: unknown; images?: unknown[] };
    if (
      media.$type === "app.bsky.embed.images" &&
      Array.isArray(media.images)
    ) {
      return { images: media.images, embedKind: "recordWithMedia" };
    }
  }
  return null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

export function imageDescriptionsFromRecord(
  record: unknown
): ImageDescription[] {
  const media = imageEmbed(record);
  if (!media) return [];
  const count = media.images.length;
  return media.images.map((item, index) => {
    const image =
      item && typeof item === "object"
        ? (item as {
            alt?: unknown;
            image?: { mimeType?: unknown };
            aspectRatio?: { width?: unknown; height?: unknown };
          })
        : {};
    const width = positiveInteger(image.aspectRatio?.width);
    const height = positiveInteger(image.aspectRatio?.height);
    const orientation =
      width && height
        ? width === height
          ? "square"
          : width > height
            ? "landscape"
            : "portrait"
        : "unknown";
    return {
      alt: typeof image.alt === "string" ? image.alt : "",
      imagePosition: index + 1,
      imageCount: count,
      mimeType:
        typeof image.image?.mimeType === "string" ? image.image.mimeType : null,
      width,
      height,
      orientation,
      embedKind: media.embedKind,
    };
  });
}

export function accessibilityCountsFromRecord(
  record: unknown
): AccessibilityCounts {
  const descriptions = imageDescriptionsFromRecord(record);
  if (descriptions.length === 0) return emptyAccessibilityCounts();
  const result = emptyAccessibilityCounts();
  result.imagePosts = 1;
  result.images = descriptions.length;
  for (const description of descriptions) {
    const alt = description.alt.trim();
    if (!alt) continue;
    result.imagesWithAlt += 1;
    // Array.from counts Unicode code points, matching Python's len() in the
    // publisher rather than UTF-16 code units.
    result.altCharacters += Array.from(alt).length;
    result.altWords += alt.split(/\s+/).filter(Boolean).length;
  }
  if (result.imagesWithAlt === result.images)
    result.fullyDescribedImagePosts = 1;
  return result;
}

/** Return the primary declared BCP-47 subtag, or unknown when absent/malformed. */
export function normalizeDeclaredLanguage(value: unknown): string {
  const raw = Array.isArray(value)
    ? value.find(item => typeof item === "string")
    : value;
  if (typeof raw !== "string") return "unknown";
  const normalized = raw.trim().replaceAll("_", "-").toLowerCase();
  const [primary, ...rest] = normalized.split("-");
  if (
    !/^[a-z]{2,8}$/.test(primary) ||
    rest.some(part => !/^[a-z0-9]{1,8}$/.test(part))
  )
    return "unknown";
  return primary;
}
