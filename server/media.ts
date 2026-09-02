export interface MediaBundle {
  images?: Array<{ thumb: string; fullsize: string; alt: string; aspectRatio?: { width: number; height: number } }>;
  linkCard?: { uri: string; title: string; description: string; thumb?: string };
  video?: { thumb: string; playlist: string };
}

const IMG_CDN = 'https://cdn.bsky.app/img';
const VIDEO_CDN = 'https://video.bsky.app/watch';

function blobCid(blob: any): string | null {
  if (!blob || typeof blob !== 'object') return null;
  if (typeof blob.ref === 'string') return blob.ref;
  return typeof blob.ref?.$link === 'string' ? blob.ref.$link : null;
}

const thumbUrl = (did: string, cid: string) => `${IMG_CDN}/feed_thumbnail/plain/${did}/${cid}@jpeg`;
const fullsizeUrl = (did: string, cid: string) => `${IMG_CDN}/feed_fullsize/plain/${did}/${cid}@jpeg`;

export function buildMediaBundle(embed: any, did: string): MediaBundle | undefined {
  if (!embed || typeof embed !== 'object' || !did) return undefined;
  const probe = embed.$type === 'app.bsky.embed.recordWithMedia' ? embed.media : embed;
  if (!probe || typeof probe !== 'object') return undefined;

  if (probe.$type === 'app.bsky.embed.images') {
    const images = (Array.isArray(probe.images) ? probe.images : []).flatMap((entry: any) => {
      const cid = blobCid(entry?.image);
      if (!cid) return [];
      const aspectRatio = Number.isFinite(entry?.aspectRatio?.width) && Number.isFinite(entry?.aspectRatio?.height)
        ? { width: entry.aspectRatio.width, height: entry.aspectRatio.height }
        : undefined;
      return [{ thumb: thumbUrl(did, cid), fullsize: fullsizeUrl(did, cid), alt: entry?.alt ?? '', aspectRatio }];
    }).slice(0, 4);
    return images.length > 0 ? { images } : undefined;
  }

  if (probe.$type === 'app.bsky.embed.external' && typeof probe.external?.uri === 'string') {
    const cid = blobCid(probe.external.thumb);
    return { linkCard: {
      uri: probe.external.uri,
      title: typeof probe.external.title === 'string' ? probe.external.title : '',
      description: typeof probe.external.description === 'string' ? probe.external.description : '',
      thumb: cid ? thumbUrl(did, cid) : undefined,
    } };
  }

  if (probe.$type === 'app.bsky.embed.video') {
    const cid = blobCid(probe.video ?? probe);
    return cid ? { video: {
      thumb: `${VIDEO_CDN}/${did}/${cid}/thumbnail.jpg`,
      playlist: `${VIDEO_CDN}/${did}/${cid}/playlist.m3u8`,
    } } : undefined;
  }

  return undefined;
}
