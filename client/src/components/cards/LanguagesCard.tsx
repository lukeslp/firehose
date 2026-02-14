/**
 * LanguagesCard.tsx - Top Languages Distribution
 *
 * Shows English count + non-English languages
 * Simple color-coded list with percentages
 */

import { DataCard } from '../DataCard';
import { getLanguageName } from '@shared/languages';

interface LanguageData {
  language: string;
  postsCount: number;
  color?: string;
}

interface LanguagesCardProps {
  languageCounts: Record<string, number>;
  className?: string;
}

export function LanguagesCard({
  languageCounts,
  className,
}: LanguagesCardProps) {
  // Prepare language data
  const languageData = Object.entries(languageCounts)
    .map(([language, count]) => ({ language, postsCount: count }))
    .sort((a, b) => b.postsCount - a.postsCount)
    .slice(0, 10)
    .map((lang, idx) => {
      const maxCount = Object.values(languageCounts).sort((a, b) => b - a)[0] || 1;
      const intensity = (lang.postsCount || 0) / maxCount;
      return {
        ...lang,
        color: `oklch(${0.65 - intensity * 0.2} ${0.15 + intensity * 0.15} ${
          200 - idx * 20
        })`,
      };
    });

  // English count
  const englishData = languageData.find(
    (l) => l.language === 'en' || l.language === 'en-US'
  );
  const englishCount = englishData?.postsCount || 0;
  const totalCount = languageData.reduce(
    (sum, l) => sum + (l.postsCount || 0),
    0
  );
  const englishPercent = totalCount > 0 ? (englishCount / totalCount) * 100 : 0;

  // Non-English languages
  const nonEnglish = languageData
    .filter((l) => l.language !== 'en' && l.language !== 'en-US')
    .slice(0, 4);
  const nonEnglishTotal = nonEnglish.reduce(
    (sum, l) => sum + (l.postsCount || 0),
    0
  );

  return (
    <DataCard title="Top Languages" className={className}>
      {languageData.length === 0 ? (
        <div className="py-8 text-center text-xs uppercase tracking-wider opacity-40">
          WAITING FOR DATA
        </div>
      ) : (
        <div className="space-y-6">
          {/* English Count */}
          <div className="border-2 border-foreground p-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                ENGLISH
              </span>
              <span className="text-xs opacity-60">{englishPercent.toFixed(1)}%</span>
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {englishCount.toLocaleString()}
            </div>
          </div>

          {/* Non-English Languages */}
          {nonEnglish.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-4 opacity-60">
                NON-ENGLISH
              </div>
              <div className="space-y-3">
                {nonEnglish.map((lang) => {
                  const percent =
                    nonEnglishTotal > 0
                      ? (lang.postsCount / nonEnglishTotal) * 100
                      : 0;
                  return (
                    <div key={lang.language} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 flex-shrink-0"
                        style={{ backgroundColor: lang.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs uppercase tracking-wider">
                            {getLanguageName(lang.language)}
                          </span>
                          <span className="text-sm font-bold tabular-nums">
                            {lang.postsCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs opacity-60">
                          {percent.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </DataCard>
  );
}
