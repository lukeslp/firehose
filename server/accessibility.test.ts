import { describe, expect, it } from "vitest";
import {
  accessibilityCountsFromRecord,
  imageDescriptionsFromRecord,
  normalizeDeclaredLanguage,
} from "../shared/accessibility";

const image = (alt: string, width = 1200, height = 800) => ({
  alt,
  image: { mimeType: "image/jpeg", ref: { $link: "bafyreitest" } },
  aspectRatio: { width, height },
});

describe("accessibility observations", () => {
  it("counts direct images with blank, partial, and complete alternatives exactly", () => {
    const blank = accessibilityCountsFromRecord({
      embed: { $type: "app.bsky.embed.images", images: [image("  ")] },
    });
    expect(blank).toMatchObject({
      imagePosts: 1,
      images: 1,
      imagesWithAlt: 0,
      fullyDescribedImagePosts: 0,
      altCharacters: 0,
      altWords: 0,
    });

    const partial = accessibilityCountsFromRecord({
      embed: {
        $type: "app.bsky.embed.images",
        images: [image("A cat"), image("")],
      },
    });
    expect(partial).toMatchObject({
      imagePosts: 1,
      images: 2,
      imagesWithAlt: 1,
      fullyDescribedImagePosts: 0,
      altCharacters: 5,
      altWords: 2,
    });

    const complete = accessibilityCountsFromRecord({
      embed: {
        $type: "app.bsky.embed.images",
        images: [image("A cat"), image("A dog")],
      },
    });
    expect(complete).toMatchObject({
      imagePosts: 1,
      images: 2,
      imagesWithAlt: 2,
      fullyDescribedImagePosts: 1,
      altCharacters: 10,
      altWords: 4,
    });
  });

  it("finds image alternatives inside recordWithMedia without treating a quote as an image", () => {
    const record = {
      embed: {
        $type: "app.bsky.embed.recordWithMedia",
        record: { uri: "at://did:plc:quoted/app.bsky.feed.post/abc" },
        media: {
          $type: "app.bsky.embed.images",
          images: [image("Diagram", 600, 900)],
        },
      },
    };
    expect(accessibilityCountsFromRecord(record)).toMatchObject({
      imagePosts: 1,
      images: 1,
      imagesWithAlt: 1,
      fullyDescribedImagePosts: 1,
    });
    expect(imageDescriptionsFromRecord(record)[0]).toMatchObject({
      embedKind: "recordWithMedia",
      orientation: "portrait",
      mimeType: "image/jpeg",
    });
    expect(
      accessibilityCountsFromRecord({
        embed: { $type: "app.bsky.embed.record", record: {} },
      }).images
    ).toBe(0);
  });

  it("normalizes only declared BCP-47 primary language tags", () => {
    expect(normalizeDeclaredLanguage(["EN_us"])).toBe("en");
    expect(normalizeDeclaredLanguage("pt-BR")).toBe("pt");
    expect(normalizeDeclaredLanguage("not a language")).toBe("unknown");
    expect(normalizeDeclaredLanguage([])).toBe("unknown");
  });
});
