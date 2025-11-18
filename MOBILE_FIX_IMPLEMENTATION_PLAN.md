# Mobile Responsiveness - Implementation Plan

**Created:** 2025-11-16
**Engineer:** TBD
**Estimated Total Time:** 26 hours (P0 + P1)
**Target Completion:** 5 business days

---

## Phase 1: Critical Fixes (P0) - 13 hours

### Task 1.1: Bundle Size Reduction (4 hours)

**Goal:** Reduce main bundle from 881KB to <350KB

**Steps:**

1. **Implement Code Splitting for Recharts** (2 hours)
   ```bash
   # Files to modify:
   # - client/src/pages/Dashboard.tsx
   # - vite.config.ts
   ```

   ```typescript
   // Dashboard.tsx
   import { lazy, Suspense } from 'react';

   // Lazy load all chart components
   const ResponsiveContainer = lazy(() =>
     import('recharts').then(m => ({ default: m.ResponsiveContainer }))
   );
   const AreaChart = lazy(() =>
     import('recharts').then(m => ({ default: m.AreaChart }))
   );
   const BarChart = lazy(() =>
     import('recharts').then(m => ({ default: m.BarChart }))
   );
   const Area = lazy(() =>
     import('recharts').then(m => ({ default: m.Area }))
   );
   const XAxis = lazy(() =>
     import('recharts').then(m => ({ default: m.XAxis }))
   );
   const YAxis = lazy(() =>
     import('recharts').then(m => ({ default: m.YAxis }))
   );
   const CartesianGrid = lazy(() =>
     import('recharts').then(m => ({ default: m.CartesianGrid }))
   );

   // Wrap chart sections in Suspense
   <Suspense fallback={<div className="h-[300px] animate-pulse bg-muted" />}>
     <ResponsiveContainer width="100%" height={300}>
       {/* ... */}
     </ResponsiveContainer>
   </Suspense>
   ```

2. **Configure Manual Chunks** (1 hour)
   ```typescript
   // vite.config.ts - Add to build config
   export default defineConfig({
     // ... existing config
     build: {
       outDir: path.resolve(__dirname, "dist/public"),
       emptyOutDir: true,
       rollupOptions: {
         output: {
           manualChunks: {
             'recharts': ['recharts'],
             'radix-ui': [
               '@radix-ui/react-dialog',
               '@radix-ui/react-dropdown-menu',
               '@radix-ui/react-popover',
               '@radix-ui/react-select',
               '@radix-ui/react-tabs',
               '@radix-ui/react-tooltip',
               '@radix-ui/react-accordion',
               '@radix-ui/react-avatar',
               '@radix-ui/react-checkbox',
               '@radix-ui/react-collapsible',
               '@radix-ui/react-context-menu',
               '@radix-ui/react-hover-card',
               '@radix-ui/react-label',
               '@radix-ui/react-menubar',
               '@radix-ui/react-navigation-menu',
               '@radix-ui/react-progress',
               '@radix-ui/react-radio-group',
               '@radix-ui/react-scroll-area',
               '@radix-ui/react-separator',
               '@radix-ui/react-slider',
               '@radix-ui/react-switch',
               '@radix-ui/react-toggle',
               '@radix-ui/react-toggle-group',
             ],
             'socket-io': ['socket.io-client'],
             'vendor': ['react', 'react-dom', 'react-hook-form'],
           }
         }
       }
     },
   });
   ```

3. **Verify Bundle Size** (1 hour)
   ```bash
   pnpm run build

   # Expected output:
   # Main bundle: ~250-350KB (down from 881KB)
   # recharts chunk: ~150-200KB
   # radix-ui chunk: ~100-150KB
   # socket-io chunk: ~50KB
   ```

**Acceptance Criteria:**
- [x] Main bundle <350KB
- [x] Charts lazy load with loading skeleton
- [x] No runtime errors from code splitting
- [x] Build completes without warnings

---

### Task 1.2: Mobile Layout Fix (6 hours)

**Goal:** Sidebar adapts to mobile viewports, no horizontal scrolling

**Steps:**

1. **Refactor Main Layout Container** (2 hours)
   ```typescript
   // Dashboard.tsx - Line 440
   // BEFORE
   <div className="flex">
     {!feedFullScreen && (
       <div className="w-1/4 border-r-2 border-foreground">
         {/* Sidebar */}
       </div>
     )}
     <div className={feedFullScreen ? "w-full" : "w-3/4"}>
       {/* Main content */}
     </div>
   </div>

   // AFTER
   <div className="flex flex-col lg:flex-row">
     {!feedFullScreen && (
       <aside className="w-full lg:w-1/4 border-b-2 lg:border-b-0 lg:border-r-2 border-foreground">
         {/* Sidebar with mobile grid layout */}
       </aside>
     )}
     <main className={`w-full ${!feedFullScreen ? 'lg:w-3/4' : ''}`}>
       {/* Main content */}
     </main>
   </div>
   ```

2. **Mobile Sidebar Grid Layout** (2 hours)
   ```typescript
   // Sidebar content adaptation
   <aside className="w-full lg:w-1/4 border-b-2 lg:border-b-0 lg:border-r-2 border-foreground">
     {/* Mobile: 2-column grid, Desktop: Vertical stack */}
     <div className="grid grid-cols-2 gap-4 p-4 lg:block lg:p-0">

       {/* Posts/Minute - Full width on mobile */}
       <div className="col-span-2 lg:col-span-1 lg:border-b-2 lg:border-foreground lg:p-6">
         <div className="text-center">
           <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">
             POSTS/MINUTE
           </div>
           <div className="text-3xl lg:text-4xl font-bold tabular-nums">
             {(stats.postsPerMinute || 0).toLocaleString()}
           </div>
         </div>
       </div>

       {/* Sentiment Visualization - Horizontal on mobile, vertical on desktop */}
       <div className="col-span-2 lg:col-span-1 lg:p-8">
         <div className="text-xs font-bold uppercase tracking-widest mb-4 lg:mb-6">
           SENTIMENT
         </div>

         {/* Mobile: Horizontal stacked bars */}
         <div className="lg:hidden space-y-3">
           {/* Positive */}
           <div>
             <div className="flex justify-between text-xs mb-1">
               <span className="font-bold uppercase">POSITIVE</span>
               <span className="tabular-nums">{posPercent.toFixed(1)}%</span>
             </div>
             <div className="h-3 border border-foreground">
               <div
                 className="h-full transition-all"
                 style={{
                   width: `${posPercent}%`,
                   background: 'oklch(0.75 0.22 145)'
                 }}
               />
             </div>
           </div>

           {/* Neutral */}
           <div>
             <div className="flex justify-between text-xs mb-1">
               <span className="font-bold uppercase">NEUTRAL</span>
               <span className="tabular-nums">{neuPercent.toFixed(1)}%</span>
             </div>
             <div className="h-3 border border-foreground">
               <div
                 className="h-full transition-all"
                 style={{
                   width: `${neuPercent}%`,
                   background: 'oklch(0.65 0.06 90)'
                 }}
               />
             </div>
           </div>

           {/* Negative */}
           <div>
             <div className="flex justify-between text-xs mb-1">
               <span className="font-bold uppercase">NEGATIVE</span>
               <span className="tabular-nums">{negPercent.toFixed(1)}%</span>
             </div>
             <div className="h-3 border border-foreground">
               <div
                 className="h-full transition-all"
                 style={{
                   width: `${negPercent}%`,
                   background: 'oklch(0.6 0.23 25)'
                 }}
               />
             </div>
           </div>
         </div>

         {/* Desktop: Vertical stacked bar (existing) */}
         <div className="hidden lg:flex flex-col items-center gap-6">
           {/* Existing vertical bar code */}
         </div>
       </div>

       {/* Languages - Adapt layout */}
       <div className="col-span-2 lg:col-span-1 lg:border-t-2 lg:border-foreground lg:p-8">
         {/* Existing language content, already responsive */}
       </div>
     </div>
   </aside>
   ```

3. **Update Header** (1 hour)
   ```typescript
   // Dashboard.tsx - Line 373-389
   <header className="border-b-2 border-foreground px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
     <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
       <div className="flex-1 min-w-0">
         <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight uppercase">
           BLUESKY FIREHOSE
         </h1>
         <p className="text-xs sm:text-sm uppercase tracking-widest mt-1" style={{ color: '#01AAFF' }}>
           REAL-TIME SENTIMENT ANALYSIS · AT PROTOCOL NETWORK
         </p>
       </div>
       <div
         className={`px-4 py-2 border-2 self-start sm:self-auto ${
           stats.running ? 'bg-[#01AAFF]/10' : ''
         }`}
         style={{ borderColor: stats.running ? '#01AAFF' : 'currentColor' }}
       >
         <span className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">
           {stats.running ? '● RUNNING' : '○ STOPPED'}
         </span>
       </div>
     </div>
   </header>
   ```

4. **Update Controls Bar** (1 hour)
   ```typescript
   // Dashboard.tsx - Line 392-437
   <div className="border-b-2 border-foreground px-4 sm:px-6 md:px-8 py-4">
     <div className="flex flex-col gap-3 sm:gap-4">
       {/* Button row */}
       <div className="flex gap-2 sm:gap-4">
         <Button
           onClick={handleStart}
           disabled={stats.running}
           variant="outline"
           className="flex-1 sm:flex-none px-4 sm:px-6 py-3 font-bold uppercase text-xs tracking-wider min-h-[44px]"
           style={{ borderRadius: 0, borderWidth: '2px' }}
         >
           START
         </Button>
         <Button
           onClick={handleStop}
           disabled={!stats.running}
           variant="outline"
           className="flex-1 sm:flex-none px-4 sm:px-6 py-3 font-bold uppercase text-xs tracking-wider min-h-[44px]"
           style={{ borderRadius: 0, borderWidth: '2px' }}
         >
           STOP
         </Button>
         <Button
           onClick={handleReset}
           variant="outline"
           className="flex-1 sm:flex-none px-4 sm:px-6 py-3 text-xs font-bold uppercase tracking-widest min-h-[44px]"
           style={{ borderRadius: 0, borderWidth: '2px' }}
         >
           RESET
         </Button>
       </div>

       {/* Search row */}
       <div className="flex gap-2 sm:gap-4">
         <Input
           placeholder="KEYWORD FILTERS (COMMA-SEPARATED)"
           value={filters}
           onChange={(e) => setFilters(e.target.value)}
           className="flex-1 uppercase text-xs border-2 min-h-[44px]"
           style={{ borderRadius: 0 }}
         />
         <Button
           onClick={handleFilterUpdate}
           variant="outline"
           className="px-4 sm:px-6 py-3 font-bold uppercase text-xs tracking-wider whitespace-nowrap min-h-[44px]"
           style={{ borderRadius: 0, borderWidth: '2px' }}
         >
           SEARCH
         </Button>
       </div>
     </div>
   </div>
   ```

**Acceptance Criteria:**
- [x] No horizontal scrolling on 375px viewport
- [x] Sidebar stacks above content on mobile
- [x] Sentiment visualization adapts (horizontal bars on mobile)
- [x] All content readable without zooming

---

### Task 1.3: Performance Optimization (3 hours)

**Goal:** Reduce jank from real-time updates on mobile

**Steps:**

1. **Throttle Socket.IO Updates** (1 hour)
   ```typescript
   // Create new hook: client/src/hooks/useThrottle.ts
   import { useRef, useCallback } from 'react';

   export function useThrottle<T extends (...args: any[]) => any>(
     callback: T,
     delay: number
   ): T {
     const lastRun = useRef(Date.now());

     return useCallback(
       (...args: Parameters<T>) => {
         const now = Date.now();
         if (now - lastRun.current >= delay) {
           lastRun.current = now;
           return callback(...args);
         }
       },
       [callback, delay]
     ) as T;
   }

   // Update useSocket.ts
   import { useThrottle } from './useThrottle';

   export function useSocket() {
     const [stats, setStats] = useState<FirehoseStats | null>(null);
     const [latestPost, setLatestPost] = useState<Post | null>(null);

     // Throttle stats updates to every 2 seconds
     const throttledSetStats = useThrottle((data: FirehoseStats) => {
       setStats(data);
     }, 2000);

     // Throttle post updates to every 500ms
     const throttledSetPost = useThrottle((data: Post) => {
       setLatestPost(data);
     }, 500);

     useEffect(() => {
       const socketInstance = io({
         path: `${import.meta.env.BASE_URL}socket.io`,
         transports: ['websocket', 'polling'],
         reconnection: true,
         reconnectionAttempts: 5,
         reconnectionDelay: 1000,
       });

       socketInstance.on('stats', throttledSetStats);
       socketInstance.on('post', throttledSetPost);

       // ... rest of socket setup
     }, [throttledSetStats, throttledSetPost]);

     return { socket, connected, stats, latestPost };
   }
   ```

2. **Memoize Expensive Calculations** (1.5 hours)
   ```typescript
   // Dashboard.tsx - Add memoization
   import { useMemo, useCallback } from 'react';

   // Memoize sentiment timeline data transformation
   const sentimentTimelineData = useMemo(() => {
     return sentimentTimeline.map(d => {
       const date = new Date(d.timestamp);
       return {
         time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
         positive: d.positive,
         neutral: d.neutral,
         negative: d.negative,
       };
     });
   }, [sentimentTimeline]);

   // Memoize language data calculation
   const languageData = useMemo(() => {
     return Object.entries(languageCounts)
       .map(([language, count]) => ({ language, postsCount: count }))
       .sort((a, b) => b.postsCount - a.postsCount)
       .slice(0, 10)
       .map((lang, idx) => {
         const maxCount = Object.values(languageCounts).sort((a, b) => b - a)[0] || 1;
         const intensity = (lang.postsCount || 0) / maxCount;
         return {
           ...lang,
           color: `oklch(${0.65 - intensity * 0.2} ${0.15 + intensity * 0.15} ${200 - idx * 20})`,
         };
       });
   }, [languageCounts]);

   // Memoize percentage calculations
   const sentimentPercentages = useMemo(() => {
     const total = (stats.sentimentCounts?.positive || 0) +
                   (stats.sentimentCounts?.neutral || 0) +
                   (stats.sentimentCounts?.negative || 0);
     return {
       posPercent: total > 0 ? ((stats.sentimentCounts?.positive || 0) / total) * 100 : 0,
       neuPercent: total > 0 ? ((stats.sentimentCounts?.neutral || 0) / total) * 100 : 0,
       negPercent: total > 0 ? ((stats.sentimentCounts?.negative || 0) / total) * 100 : 0,
     };
   }, [stats.sentimentCounts]);

   const { posPercent, neuPercent, negPercent } = sentimentPercentages;
   ```

3. **Optimize Post Feed Rendering** (0.5 hours)
   ```typescript
   // Create PostCard component with React.memo
   // client/src/components/dashboard/PostCard.tsx
   import { memo } from 'react';

   interface PostCardProps {
     post: Post;
     index: number;
   }

   export const PostCard = memo(({ post, index }: PostCardProps) => {
     return (
       <div
         key={post.uri || `post-${index}-${post.createdAt}`}
         className="border border-border rounded-xl p-5 hover:shadow-lg transition-all duration-200"
         style={{
           backgroundColor: post.sentiment === 'positive'
             ? 'oklch(0.7 0.2 145 / 0.12)'
             : post.sentiment === 'negative'
             ? 'oklch(0.55 0.22 25 / 0.12)'
             : 'oklch(0.6 0.05 90 / 0.08)',
           boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
         }}
       >
         {/* Existing post content */}
       </div>
     );
   }, (prevProps, nextProps) => {
     // Only re-render if post URI changes
     return prevProps.post.uri === nextProps.post.uri;
   });

   // Use in Dashboard.tsx
   import { PostCard } from '@/components/dashboard/PostCard';

   {posts
     .filter((post) => {
       if (feedLanguageFilter !== 'all' && post.language && !post.language.startsWith(feedLanguageFilter)) {
         return false;
       }
       return true;
     })
     .slice(0, 20)
     .map((post, idx) => (
       <PostCard key={post.uri || `post-${idx}`} post={post} index={idx} />
     ))
   }
   ```

**Acceptance Criteria:**
- [x] Socket.IO updates throttled to 2s for stats, 500ms for posts
- [x] Expensive calculations memoized
- [x] Post cards use React.memo
- [x] No visible jank on mobile (60fps scrolling)

---

## Phase 2: High Priority (P1) - 13 hours

### Task 2.1: Touch Target Compliance (2 hours)

**Goal:** All interactive elements ≥44px

**Steps:**

1. **Audit All Interactive Elements** (0.5 hours)
   ```bash
   # Search for all buttons and interactive elements
   grep -r "Button\|button\|onClick" client/src/pages/Dashboard.tsx > touch-audit.txt
   ```

2. **Apply Minimum Touch Targets** (1 hour)
   ```typescript
   // Update all buttons to ensure min 44px height
   // Add to index.css
   @layer components {
     .btn-touch {
       @apply min-h-[44px] min-w-[44px];
     }
   }

   // Apply to all buttons in Dashboard.tsx
   <Button className="btn-touch px-6 py-3...">
   ```

3. **Test on Device** (0.5 hours)
   - Use Chrome DevTools device emulator
   - Test on real iPhone/Android if available
   - Verify all buttons are easily tappable

**Acceptance Criteria:**
- [x] All buttons ≥44px height and width
- [x] Selects and inputs ≥44px
- [x] Links and clickable areas ≥44px
- [x] No accidental mis-taps during testing

---

### Task 2.2: Component Extraction (8 hours)

**Goal:** Split Dashboard into maintainable modules

**Steps:**

1. **Create Component Structure** (0.5 hours)
   ```bash
   mkdir -p client/src/components/dashboard
   touch client/src/components/dashboard/{
     DashboardHeader,
     DashboardControls,
     DashboardSidebar,
     LiveFeed,
     SentimentTimeline,
     ContentTypesGrid,
     DashboardFooter,
     PostCard
   }.tsx
   ```

2. **Extract Header Component** (1 hour)
   ```typescript
   // client/src/components/dashboard/DashboardHeader.tsx
   interface DashboardHeaderProps {
     stats: {
       running: boolean;
     };
   }

   export function DashboardHeader({ stats }: DashboardHeaderProps) {
     return (
       <header className="border-b-2 border-foreground px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
         {/* Move header content here */}
       </header>
     );
   }
   ```

3. **Extract Controls Component** (1 hour)
   ```typescript
   // client/src/components/dashboard/DashboardControls.tsx
   interface DashboardControlsProps {
     running: boolean;
     filters: string;
     onStart: () => void;
     onStop: () => void;
     onReset: () => void;
     onFiltersChange: (filters: string) => void;
     onFilterUpdate: () => void;
   }

   export function DashboardControls({ ... }: DashboardControlsProps) {
     return (
       <div className="border-b-2 border-foreground px-4 sm:px-6 md:px-8 py-4">
         {/* Move controls here */}
       </div>
     );
   }
   ```

4. **Extract Sidebar Component** (2 hours)
   ```typescript
   // client/src/components/dashboard/DashboardSidebar.tsx
   interface DashboardSidebarProps {
     stats: FirehoseStats;
     languageData: any[];
     sentimentPercentages: {
       posPercent: number;
       neuPercent: number;
       negPercent: number;
     };
   }

   export function DashboardSidebar({ ... }: DashboardSidebarProps) {
     return (
       <aside className="w-full lg:w-1/4 border-b-2 lg:border-b-0 lg:border-r-2 border-foreground">
         {/* Move sidebar content here */}
       </aside>
     );
   }
   ```

5. **Extract Live Feed Component** (2 hours)
   ```typescript
   // client/src/components/dashboard/LiveFeed.tsx
   import { PostCard } from './PostCard';

   interface LiveFeedProps {
     posts: Post[];
     feedLanguageFilter: string;
     samplingRate: number;
     feedFullScreen: boolean;
     onLanguageFilterChange: (filter: string) => void;
     onSamplingRateChange: (rate: number) => void;
     onToggleFullScreen: () => void;
     isFullScreenMode: boolean;
   }

   export function LiveFeed({ ... }: LiveFeedProps) {
     return (
       <div className="border-b-2 border-foreground">
         {/* Move live feed content here */}
       </div>
     );
   }
   ```

6. **Extract Timeline & Grid Components** (1 hour each)
   - SentimentTimeline.tsx
   - ContentTypesGrid.tsx
   - DashboardFooter.tsx

7. **Update Main Dashboard** (0.5 hours)
   ```typescript
   // Dashboard.tsx - Now much cleaner
   import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
   import { DashboardControls } from '@/components/dashboard/DashboardControls';
   import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
   import { LiveFeed } from '@/components/dashboard/LiveFeed';
   import { SentimentTimeline } from '@/components/dashboard/SentimentTimeline';
   import { ContentTypesGrid } from '@/components/dashboard/ContentTypesGrid';
   import { DashboardFooter } from '@/components/dashboard/DashboardFooter';

   export default function Dashboard() {
     // State and hooks remain here
     // ...

     return (
       <div className="min-h-screen bg-background text-foreground">
         <DashboardHeader stats={stats} />
         <DashboardControls
           running={running}
           filters={filters}
           onStart={handleStart}
           onStop={handleStop}
           onReset={handleReset}
           onFiltersChange={setFilters}
           onFilterUpdate={handleFilterUpdate}
         />

         <div className="flex flex-col lg:flex-row">
           {!feedFullScreen && (
             <DashboardSidebar
               stats={stats}
               languageData={languageData}
               sentimentPercentages={sentimentPercentages}
             />
           )}

           <main className={`w-full ${!feedFullScreen ? 'lg:w-3/4' : ''}`}>
             <LiveFeed
               posts={posts}
               feedLanguageFilter={feedLanguageFilter}
               samplingRate={samplingRate}
               feedFullScreen={feedFullScreen}
               onLanguageFilterChange={setFeedLanguageFilter}
               onSamplingRateChange={setSamplingRate}
               onToggleFullScreen={toggleFullScreen}
               isFullScreenMode={isFullScreenMode}
             />

             <SentimentTimeline
               sentimentTimeline={sentimentTimeline}
               sentimentTimelineData={sentimentTimelineData}
               timelineIsStable={timelineIsStable}
               totalTimelinePosts={totalTimelinePosts}
             />

             <ContentTypesGrid
               contentTypeCounts={contentTypeCounts}
               hashtagCounts={hashtagCounts}
             />
           </main>
         </div>

         <DashboardFooter onExportCSV={handleExportCSV} />
       </div>
     );
   }
   ```

**Acceptance Criteria:**
- [x] Dashboard.tsx reduced to <200 lines
- [x] Each component in separate file
- [x] TypeScript interfaces for all props
- [x] All components properly exported and imported
- [x] No functionality broken

---

### Task 2.3: Accessibility Enhancements (3 hours)

**Goal:** WCAG 2.1 AA compliance

**Steps:**

1. **Add ARIA Labels to Charts** (1 hour)
   ```typescript
   // SentimentTimeline.tsx
   <div
     role="region"
     aria-label="Sentiment timeline showing positive, neutral, and negative post trends over the last 60 minutes"
   >
     <ResponsiveContainer width="100%" height={300}>
       <AreaChart
         data={sentimentTimelineData}
         aria-label="Area chart visualizing sentiment distribution"
       >
         {/* ... */}
       </AreaChart>
     </ResponsiveContainer>
   </div>

   // Add screen reader text for current values
   <div className="sr-only">
     Current sentiment distribution: {posPercent.toFixed(1)}% positive,
     {neuPercent.toFixed(1)}% neutral, {negPercent.toFixed(1)}% negative
   </div>
   ```

2. **Respect Reduced Motion** (1 hour)
   ```css
   /* index.css */
   @media (prefers-reduced-motion: reduce) {
     * {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

   ```typescript
   // Use in components
   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

   <Area
     type="monotone"
     dataKey="positive"
     animationDuration={prefersReducedMotion ? 0 : 800}
   />
   ```

3. **Keyboard Navigation** (1 hour)
   ```typescript
   // LiveFeed.tsx - Add keyboard controls
   <select
     value={feedLanguageFilter}
     onChange={(e) => onLanguageFilterChange(e.target.value)}
     onKeyDown={(e) => {
       if (e.key === 'Enter') {
         e.currentTarget.blur();
       }
     }}
     aria-label="Filter posts by language"
     className="..."
   >
     {/* ... */}
   </select>

   // Add focus styles
   /* index.css */
   @layer components {
     .focus-ring {
       @apply focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
     }
   }
   ```

**Acceptance Criteria:**
- [x] All charts have ARIA labels
- [x] Reduced motion preference respected
- [x] Keyboard navigation works for all controls
- [x] Focus indicators visible on all interactive elements

---

## Phase 3: Testing & Validation (8 hours)

### Task 3.1: Mobile Device Testing (4 hours)

**Test Matrix:**

| Device | Viewport | Browser | Tester | Status |
|--------|----------|---------|--------|--------|
| iPhone 14 Pro | 393×852 | Safari | TBD | ⬜ |
| iPhone SE | 375×667 | Safari | TBD | ⬜ |
| Samsung Galaxy S22 | 360×800 | Chrome | TBD | ⬜ |
| iPad Mini | 768×1024 | Safari | TBD | ⬜ |
| iPad Pro | 1024×1366 | Safari | TBD | ⬜ |
| Generic Android Tablet | 800×1280 | Chrome | TBD | ⬜ |

**Test Checklist per Device:**
- [ ] No horizontal scrolling
- [ ] All content readable without zoom
- [ ] Touch targets ≥44px
- [ ] Charts render correctly
- [ ] Socket.IO connects and updates
- [ ] Full screen mode works
- [ ] Language filter works
- [ ] Sentiment visualization displays correctly
- [ ] Posts load and display properly
- [ ] Export CSV functions
- [ ] Orientation change (portrait/landscape)

**Steps:**
1. Use Chrome DevTools device emulation (2 hours)
2. Test on real devices if available (1 hour)
3. Document bugs in GitHub issues (1 hour)

---

### Task 3.2: Performance Testing (2 hours)

**Lighthouse Metrics:**

Run Lighthouse on:
- Desktop (baseline)
- Mobile (4G throttled)
- Mobile (3G throttled)

**Target Scores:**
- Performance: ≥80
- Accessibility: ≥95
- Best Practices: ≥90
- SEO: ≥90

**Steps:**
1. Run Lighthouse on localhost:5173
2. Run Lighthouse on production URL
3. Document results in PERFORMANCE.md
4. Identify and fix any regressions

**Commands:**
```bash
# Desktop
lighthouse http://localhost:5173/bluesky/firehose/ --output html --output-path ./reports/desktop.html

# Mobile 4G
lighthouse http://localhost:5173/bluesky/firehose/ --emulated-form-factor=mobile --throttling.rttMs=150 --throttling.throughputKbps=1600 --output html --output-path ./reports/mobile-4g.html

# Mobile 3G
lighthouse http://localhost:5173/bluesky/firehose/ --emulated-form-factor=mobile --throttling-method=devtools --output html --output-path ./reports/mobile-3g.html
```

---

### Task 3.3: Visual Regression Testing (2 hours)

**Setup Playwright:**

```bash
pnpm add -D @playwright/test
npx playwright install
```

**Create test file:**
```typescript
// tests/mobile-responsive.spec.ts
import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'iPhone 14 Pro', width: 393, height: 852 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Galaxy S22', width: 360, height: 800 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

viewports.forEach(({ name, width, height }) => {
  test(`Dashboard renders correctly on ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('http://localhost:5173/bluesky/firehose/');

    // Wait for dashboard to load
    await page.waitForSelector('header h1:has-text("BLUESKY FIREHOSE")');

    // Take screenshot
    await page.screenshot({
      path: `screenshots/${name.replace(' ', '-')}.png`,
      fullPage: true,
    });

    // Check no horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    // Check all buttons are visible
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      await expect(buttons.nth(i)).toBeVisible();
    }
  });
});
```

**Run tests:**
```bash
npx playwright test
```

---

## Verification Checklist

### Before Marking Complete:

#### Bundle Size
- [ ] Main JS bundle <350KB
- [ ] Build warnings resolved
- [ ] Recharts loaded lazily
- [ ] Manual chunks configured

#### Layout
- [ ] No horizontal scroll on 375px viewport
- [ ] Sidebar stacks on mobile
- [ ] Header wraps correctly
- [ ] Controls stack on mobile
- [ ] All content accessible without zoom

#### Performance
- [ ] Socket.IO updates throttled
- [ ] Calculations memoized
- [ ] Post cards use React.memo
- [ ] 60fps scrolling on mobile

#### Touch Targets
- [ ] All buttons ≥44px
- [ ] All inputs ≥44px
- [ ] All links ≥44px

#### Components
- [ ] Dashboard.tsx <200 lines
- [ ] Components extracted and working
- [ ] TypeScript errors resolved
- [ ] No runtime errors

#### Accessibility
- [ ] Charts have ARIA labels
- [ ] Reduced motion respected
- [ ] Keyboard navigation works
- [ ] Focus indicators visible

#### Testing
- [ ] Mobile devices tested
- [ ] Lighthouse scores meet targets
- [ ] Visual regression tests pass
- [ ] No console errors

---

## Deployment

### Pre-deployment:
1. Run full test suite: `pnpm test`
2. Build production bundle: `pnpm run build`
3. Verify bundle sizes
4. Check Lighthouse scores
5. Test on staging environment

### Deployment:
```bash
# Build
pnpm run build

# Deploy (adjust for your deployment process)
# Example: Copy to production directory
cp -r dist/* /var/www/firehose/
```

### Post-deployment:
1. Test on production URL
2. Monitor error logs
3. Check analytics for mobile bounce rate
4. Gather user feedback

---

## Success Metrics

### Technical Metrics:
- Bundle size: <350KB (from 881KB) ✅
- LCP on mobile 4G: <2.5s ✅
- TTI on mobile 4G: <5s ✅
- Lighthouse Performance: ≥80 ✅

### User Experience Metrics:
- Mobile bounce rate: <20%
- Session duration on mobile: >2 minutes
- Error rate: <0.1%
- User satisfaction (survey): ≥4.0/5.0

---

**Implementation Start Date:** TBD
**Target Completion Date:** TBD
**Assigned Engineer:** TBD
**Reviewer:** Engineering Lead
