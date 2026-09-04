export type AccessibilityMetricRow = {
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
};

export type AccessibilitySummary = {
  postTotal: number;
  imagePosts: number;
  images: number;
  imagesWithAlt: number;
  imagesMissingAlt: number;
  fullyDescribed: number;
  altCharacters: number;
  altWords: number;
  altDescriptions: number;
  lengthBins: {
    len_1_25: number;
    len_26_75: number;
    len_76_150: number;
    len_151_300: number;
    len_301_plus: number;
  };
};

export function summarizeAccessibility(
  rows: AccessibilityMetricRow[]
): AccessibilitySummary {
  const summary = rows.reduce<AccessibilitySummary>(
    (result, row) => ({
      postTotal: result.postTotal + row.post_total,
      imagePosts: result.imagePosts + row.image_posts,
      images: result.images + row.images,
      imagesWithAlt: result.imagesWithAlt + row.images_with_alt,
      imagesMissingAlt:
        result.imagesMissingAlt + Math.max(0, row.images - row.images_with_alt),
      fullyDescribed: result.fullyDescribed + row.fully_described_image_posts,
      altCharacters: result.altCharacters + row.alt_characters,
      altWords: result.altWords + row.alt_words,
      altDescriptions: result.altDescriptions + row.alt_descriptions,
      lengthBins: {
        len_1_25: result.lengthBins.len_1_25 + row.len_1_25,
        len_26_75: result.lengthBins.len_26_75 + row.len_26_75,
        len_76_150: result.lengthBins.len_76_150 + row.len_76_150,
        len_151_300: result.lengthBins.len_151_300 + row.len_151_300,
        len_301_plus: result.lengthBins.len_301_plus + row.len_301_plus,
      },
    }),
    {
      postTotal: 0,
      imagePosts: 0,
      images: 0,
      imagesWithAlt: 0,
      imagesMissingAlt: 0,
      fullyDescribed: 0,
      altCharacters: 0,
      altWords: 0,
      altDescriptions: 0,
      lengthBins: {
        len_1_25: 0,
        len_26_75: 0,
        len_76_150: 0,
        len_151_300: 0,
        len_301_plus: 0,
      },
    }
  );
  return summary;
}

export function safeMean(total: number, count: number) {
  return count ? total / count : null;
}
