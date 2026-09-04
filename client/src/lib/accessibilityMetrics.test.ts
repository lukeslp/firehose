import { describe, expect, it } from "vitest";
import { safeMean, summarizeAccessibility } from "./accessibilityMetrics";

describe("accessibility metric summaries", () => {
  it("adds published counts and derives missing alternatives", () => {
    const summary = summarizeAccessibility([
      {
        post_total: 10,
        image_posts: 4,
        images: 6,
        images_with_alt: 4,
        fully_described_image_posts: 2,
        alt_characters: 80,
        alt_words: 16,
        alt_descriptions: 4,
        len_1_25: 1,
        len_26_75: 2,
        len_76_150: 1,
        len_151_300: 0,
        len_301_plus: 0,
      },
      {
        post_total: 5,
        image_posts: 2,
        images: 3,
        images_with_alt: 1,
        fully_described_image_posts: 1,
        alt_characters: 20,
        alt_words: 4,
        alt_descriptions: 1,
        len_1_25: 1,
        len_26_75: 0,
        len_76_150: 0,
        len_151_300: 0,
        len_301_plus: 0,
      },
    ]);

    expect(summary).toMatchObject({
      postTotal: 15,
      images: 9,
      imagesWithAlt: 5,
      imagesMissingAlt: 4,
      altWords: 20,
      altDescriptions: 5,
    });
    expect(summary.lengthBins).toEqual({
      len_1_25: 2,
      len_26_75: 2,
      len_76_150: 1,
      len_151_300: 0,
      len_301_plus: 0,
    });
    expect(safeMean(summary.altWords, summary.altDescriptions)).toBe(4);
  });

  it("returns no mean when the denominator is zero", () => {
    expect(safeMean(0, 0)).toBeNull();
    expect(summarizeAccessibility([]).imagesMissingAlt).toBe(0);
  });
});
