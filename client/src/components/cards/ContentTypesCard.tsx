/**
 * ContentTypesCard.tsx - Content Type Breakdown
 *
 * Shows counts for:
 * - Text only
 * - With images
 * - With video
 * - With links
 */

import { DataCard } from '../DataCard';

interface ContentTypeCounts {
  textOnly: number;
  withImages: number;
  withVideo: number;
  withLinks: number;
}

interface ContentTypesCardProps {
  contentTypeCounts: ContentTypeCounts;
  className?: string;
}

export function ContentTypesCard({
  contentTypeCounts,
  className,
}: ContentTypesCardProps) {
  return (
    <DataCard title="Content Types" className={className}>
      <div className="space-y-4">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold uppercase tracking-wider">
            TEXT ONLY
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {contentTypeCounts.textOnly.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold uppercase tracking-wider">
            WITH IMAGES
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {contentTypeCounts.withImages.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold uppercase tracking-wider">
            WITH VIDEO
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {contentTypeCounts.withVideo.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold uppercase tracking-wider">
            WITH LINKS
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {contentTypeCounts.withLinks.toLocaleString()}
          </span>
        </div>
      </div>
    </DataCard>
  );
}
