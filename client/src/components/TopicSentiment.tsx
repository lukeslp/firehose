import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

export function TopicSentiment() {
  const [keyword, setKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");

  const { data, isLoading, refetch } = trpc.stats.sentimentByKeyword.useQuery(
    { keyword: activeKeyword },
    { enabled: activeKeyword.length > 0, refetchInterval: 5000 }
  );

  const handleSearch = () => {
    if (keyword.trim()) {
      setActiveKeyword(keyword.trim());
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('en-US');

  if (!activeKeyword) {
    return (
      <div className="swiss-card">
        <h2 className="text-section-title mb-4">LIVE TOPIC SENTIMENT</h2>
        <p className="text-sm mb-4 opacity-70">
          Track real-time sentiment for any keyword or topic
        </p>
        <div className="flex gap-2">
          <Input 
            type="text"
            placeholder="ENTER KEYWORD (E.G., BITCOIN, POLITICS, AI)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 uppercase text-xs border-border"
            style={{ borderRadius: 0 }}
          />
          <Button 
            onClick={handleSearch}
            disabled={!keyword.trim()}
            className="px-6 py-3 font-bold uppercase text-xs tracking-wider border border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background transition-all duration-200"
          >
            TRACK
          </Button>
        </div>
      </div>
    );
  }

  const total = (data?.sentimentCounts.positive || 0) + (data?.sentimentCounts.negative || 0) + (data?.sentimentCounts.neutral || 0);
  const positivePercent = total > 0 ? ((data?.sentimentCounts.positive || 0) / total) * 100 : 0;
  const neutralPercent = total > 0 ? ((data?.sentimentCounts.neutral || 0) / total) * 100 : 0;
  const negativePercent = total > 0 ? ((data?.sentimentCounts.negative || 0) / total) * 100 : 0;

  return (
    <div className="swiss-card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-section-title mb-1">TOPIC: "{activeKeyword.toUpperCase()}"</h2>
          <p className="text-xs opacity-60">LIVE SENTIMENT ANALYSIS</p>
        </div>
        <Button 
          onClick={() => setActiveKeyword("")}
          variant="outline"
          className="text-xs font-bold"
        >
          CHANGE
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          LOADING...
        </div>
      ) : data && data.totalPosts > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-stat-label mb-1">TOTAL POSTS</div>
              <div className="text-2xl font-bold tabular-nums">
                {formatNumber(data.totalPosts)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-stat-label mb-1">AVG LENGTH</div>
              <div className="text-2xl font-bold tabular-nums">
                {data.avgPostLength}
              </div>
            </div>
            <div className="text-center">
              <div className="text-stat-label mb-1">AVG WORDS</div>
              <div className="text-2xl font-bold tabular-nums">
                {data.avgWordCount}
              </div>
            </div>
            <div className="text-center">
              <div className="text-stat-label mb-1">SENTIMENT</div>
              <div className="text-2xl font-bold tabular-nums" style={{ 
                color: positivePercent > negativePercent ? 'oklch(0.6 0.2 250)' : 
                       negativePercent > positivePercent ? 'oklch(0.55 0.22 27)' : 
                       'oklch(0.6 0 0)'
              }}>
                {positivePercent > negativePercent ? 'POS' : 
                 negativePercent > positivePercent ? 'NEG' : 'NEU'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-stat-label mb-1">POSITIVE</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: 'oklch(0.6 0.2 250)' }}>
                {formatNumber(data.sentimentCounts.positive)}
              </div>
              <div className="text-xs opacity-60">{positivePercent.toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="text-stat-label mb-1">NEUTRAL</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: 'oklch(0.6 0 0)' }}>
                {formatNumber(data.sentimentCounts.neutral)}
              </div>
              <div className="text-xs opacity-60">{neutralPercent.toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="text-stat-label mb-1">NEGATIVE</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: 'oklch(0.55 0.22 27)' }}>
                {formatNumber(data.sentimentCounts.negative)}
              </div>
              <div className="text-xs opacity-60">{negativePercent.toFixed(1)}%</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={[
              { name: 'Sentiment', positive: positivePercent, neutral: neutralPercent, negative: negativePercent }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.93 0 0)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'oklch(0.2 0 0)' }} stroke="oklch(0 0 0)" />
              <YAxis tick={{ fontSize: 10, fill: 'oklch(0.2 0 0)' }} stroke="oklch(0 0 0)" domain={[0, 100]} />
              <Area type="monotone" dataKey="positive" stackId="1" stroke="oklch(0.6 0.2 250)" fill="oklch(0.6 0.2 250)" fillOpacity={0.6} />
              <Area type="monotone" dataKey="neutral" stackId="1" stroke="oklch(0.6 0 0)" fill="oklch(0.6 0 0)" fillOpacity={0.6} />
              <Area type="monotone" dataKey="negative" stackId="1" stroke="oklch(0.55 0.22 27)" fill="oklch(0.55 0.22 27)" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          NO POSTS FOUND FOR "{activeKeyword.toUpperCase()}"
          <br />
          <span className="text-xs">TRY A DIFFERENT KEYWORD</span>
        </div>
      )}
    </div>
  );
}
