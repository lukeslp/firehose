/**
 * PostsPerMinuteCard.tsx - Line Chart of Post Rate
 *
 * Shows posts per minute over time
 * Uses Recharts LineChart
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { DataCard } from '../DataCard';

interface PostsPerMinuteData {
  timestamp: number;
  rate: number;
}

interface PostsPerMinuteCardProps {
  data: PostsPerMinuteData[];
  currentRate?: number;
  className?: string;
}

export function PostsPerMinuteCard({
  data,
  currentRate = 0,
  className,
}: PostsPerMinuteCardProps) {
  // Prepare chart data
  const chartData = data.map((d) => {
    const date = new Date(d.timestamp);
    return {
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      rate: d.rate,
    };
  });

  return (
    <DataCard title="Posts Per Minute" className={className} defaultExpanded>
      {/* Current Rate Display */}
      <div className="text-center mb-4 pb-4 border-b-2 border-foreground/20">
        <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">
          CURRENT RATE
        </div>
        <div className="text-3xl font-bold tabular-nums">
          {currentRate.toLocaleString()}
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="py-12 text-center text-xs uppercase tracking-wider opacity-40">
          WAITING FOR DATA
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="colorPostsPerMinute" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#01AAFF" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#01AAFF" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" stroke="currentColor" strokeOpacity={0.1} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10 }} stroke="currentColor" />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#01AAFF"
              strokeWidth={3}
              dot={false}
              fill="url(#colorPostsPerMinute)"
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </DataCard>
  );
}
