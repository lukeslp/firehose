import Sentiment from 'sentiment';

const sentiment = new Sentiment();

export interface SentimentResult {
  score: number;
  comparative: number;
  classification: 'positive' | 'negative' | 'neutral';
  positive: string[];
  negative: string[];
}

/**
 * Analyze sentiment of text using VADER-like algorithm
 * Score ranges from -5 to +5 (normalized to -1 to +1)
 * Comparative score is normalized by word count
 */
export function analyzeSentiment(text: string): SentimentResult {
  if (!text || text.trim().length === 0) {
    return {
      score: 0,
      comparative: 0,
      classification: 'neutral',
      positive: [],
      negative: [],
    };
  }

  const result = sentiment.analyze(text);
  
  // Classify based on comparative score (normalized by word count)
  let classification: 'positive' | 'negative' | 'neutral';
  
  if (result.comparative > 0.05) {
    classification = 'positive';
  } else if (result.comparative < -0.05) {
    classification = 'negative';
  } else {
    classification = 'neutral';
  }

  return {
    score: result.score,
    comparative: result.comparative,
    classification,
    positive: result.positive,
    negative: result.negative,
  };
}

/**
 * Extract linguistic features from text
 */
export function extractFeatures(text: string, record?: any) {
  // Character and word count
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

  // Extract hashtags - support Unicode characters
  // First try to get from facets (structured data)
  let hashtags: string[] = [];
  if (record?.facets) {
    for (const facet of record.facets) {
      for (const feature of facet.features || []) {
        if (feature.$type === 'app.bsky.richtext.facet#tag') {
          hashtags.push(`#${feature.tag}`);
        }
      }
    }
  }
  
  // Fallback to regex - match # followed by any non-whitespace characters
  if (hashtags.length === 0) {
    // Match # followed by word characters and common Unicode ranges
    const hashtagMatches = text.match(/#[\w\u0080-\uFFFF]+/g) || [];
    hashtags = hashtagMatches;
  }

  // Extract mentions
  const mentions = text.match(/@[\w.]+/g) || [];

  // Extract URLs
  const urls = text.match(/https?:\/\/[^\s]+/g) || [];

  // Detect language from record if available
  let language = 'unknown';
  if (record?.langs && Array.isArray(record.langs) && record.langs.length > 0) {
    language = record.langs[0];
  }
  

  // Check for media and embeds
  const embed = record?.embed || {};
  const embedType = embed.$type || '';

  const hasImages = embedType.includes('images');
  const hasVideo = embedType.includes('video');
  const hasLink = embedType.includes('external') || urls.length > 0;

  // Quote posts
  let isQuote = false;
  let quoteUri = null;
  
  if (embedType === 'app.bsky.embed.record') {
    isQuote = true;
    quoteUri = embed.record?.uri;
  } else if (embedType === 'app.bsky.embed.recordWithMedia') {
    isQuote = true;
    quoteUri = embed.record?.record?.uri;
  }

  return {
    charCount,
    wordCount,
    hashtags: JSON.stringify(hashtags),
    mentions: JSON.stringify(mentions),
    links: JSON.stringify(urls),
    language,
    hasImages,
    hasVideo,
    hasLink,
    isQuote,
    quoteUri,
  };
}
