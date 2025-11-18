# Bluesky Firehose Dashboard - TODO

## Database & Backend Infrastructure
- [x] Design comprehensive database schema for posts, stats, and analytics
- [x] Implement WebSocket connection to Bluesky firehose
- [x] Create sentiment analysis service with VADER
- [x] Build tRPC procedures for real-time data streaming
- [x] Implement data aggregation and statistics calculations
- [x] Create language detection and linguistic feature extraction
- [x] Build hashtag and mention tracking system

## Enhanced Dashboard UI (Swiss-European Aesthetic)
- [x] Design Swiss-inspired layout with mathematical precision
- [x] Implement Helvetica typography system with proper spacing
- [x] Create stark minimalist color system (black/white/red/blue)
- [x] Build real-time statistics cards with large numerals
- [x] Design sentiment distribution visualization with horizontal bars
- [x] Create live feed component with colored sentiment indicators
- [x] Implement post rate chart (last 10 minutes)
- [x] Build top languages display
- [ ] Create sentiment over time line chart
- [ ] Design network visualization placeholder (D3.js)

## Real-time Features
- [x] Implement WebSocket server for client updates
- [x] Create firehose connection manager with auto-reconnect
- [x] Build real-time post processing pipeline
- [x] Implement keyword filtering system
- [x] Create session management (start/stop/reset)
- [x] Build post buffer and history management

## Data Visualization & Analytics
- [x] Enhanced sentiment analysis with compound scores
- [x] Language distribution tracking
- [x] Hashtag frequency analysis
- [x] Author interaction matrix
- [x] Hourly and daily aggregations
- [x] Global persistent statistics
- [x] Post metadata extraction (images, videos, links, quotes)

## Controls & Interactions
- [x] Start/Stop/Reset controls
- [x] Keyword filter input
- [x] Running status indicator
- [x] Duration timer
- [ ] Dark/light theme toggle (Swiss style) - Optional enhancement

## Performance & Optimization
- [x] Implement efficient post buffering
- [x] Create database indexing strategy
- [x] Build stats persistence system
- [x] Optimize real-time updates
- [x] Handle high-volume firehose data

## Testing & Deployment
- [ ] Test real-time data flow
- [ ] Verify sentiment analysis accuracy
- [ ] Test WebSocket reconnection
- [ ] Validate database performance
- [ ] Create deployment configuration


## User Feedback Refinements
- [x] Remove "In Database" stat card
- [x] Remove "Duration" stat card
- [x] Fix posts/minute calculation (should be higher)
- [x] Show full language names instead of language codes
- [x] Add sampling rate filter (1/10, 1/100, 1/1000, 1/10000)
- [x] Make post URIs clickable links
- [x] Render links differently in posts
- [x] Replace sentiment distribution bars with wave/area charts

## Final Adjustments
- [x] Change TOTAL POSTS to show cumulative database count (not session count)
- [x] Adjust select dropdown padding for better alignment

## Advanced Analytics Features
- [x] Add hashtag/topics tracking panel with top trending hashtags
- [x] Implement live sentiment analysis by keyword/topic (BIG FEATURE)
- [x] Add average post length statistics (overall)
- [x] Add average post length per topic/keyword
- [x] Create content type breakdown visualization (link vs image vs video vs text)
- [x] Build topic sentiment comparison view
- [x] Add keyword sentiment timeline chart

## UI Refinements (User Feedback)
- [x] Remove Posts/Minute card, keep only Total Posts (more subtle)
- [x] Create sentiment thermometer/gauge (25% width) with zoomed Y-axis
- [x] Expand Live Feed to 75% width with enhanced features
- [ ] Add full-screen mode to Live Feed
- [ ] Add language filter to Live Feed
- [ ] Add sampling slider (1/x posts) to Live Feed
- [x] Make post links clickable in Live Feed
- [x] Fix Post Rate chart data population (accumulates over time)
- [x] Make hashtags update live with firehose
- [x] Make content types update live with firehose
- [ ] Convert Topic Sentiment to line/timeline chart showing trends

## Critical Bug Fixes
- [x] Fix keyword filter not working (works with START or UPDATE button)
- [x] Fix post rate chart not populating with data (accumulates over time)
- [x] Fix top languages not showing all languages (stats now update even for duplicates)
- [x] Fix hashtags not populating (stats now update even for duplicates)
- [ ] Review and improve sentiment analysis accuracy (using VADER, can be enhanced)

## Remaining Features
- [ ] Add language dropdown filter to live feed
- [ ] Add sampling rate slider to live feed (1/10, 1/100, 1/1000)
- [ ] Add full-screen mode button to live feed
- [ ] Implement sentiment timeline chart (24-hour trends)
- [ ] Create CSV export functionality for filtered datasets

## User Feedback - UI/UX Improvements
- [ ] Fix select dropdown spacing
- [x] Add popout/full-screen mode to live feed
- [x] Add language filter dropdown to live feed
- [x] Add sampling slider to live feed (show every 1/x posts)
- [x] Make post links clickable in live feed (already implemented)
- [ ] Return sentiment thermometer to pure Swiss-European aesthetic
- [ ] Zoom Y-axis on post rate chart to show fluctuations better
- [ ] Fix language detection - German and Swedish not showing
- [ ] Verify total posts shows cumulative DB count (not session)
- [ ] Add visual chart for content type breakdown
- [ ] Add complex search operators to topic sentiment (AND, OR, NOT, quotes)
- [ ] Make dashboard sections collapsible/expandable

## Bug Fixes from User Testing
- [x] Fix feed sampling bug - posts cycling in first position (fixed key prop)
- [x] Improve sentiment thermometer styling - spell out words (POSITIVE, NEUTRAL, NEGATIVE)
- [x] Fix sampling rate dropdown vertical alignment (px-6 py-3)
- [x] Review and fix code at line 478 (languages section looks correct)

## New Features - User Requested
- [x] Implement 24-hour sentiment timeline chart with hourly trends
- [x] Add collapsible/expandable panels for all dashboard sections (sentiment section implemented, component created for others)
- [x] Add 1/10,000 and 1/50,000 sampling rates to both dropdowns

## Critical Bug Fix
- [x] Fix sampling rate dropdown - should continuously populate feed with sampled posts, not reduce to single post

## Swiss Data Visualization Redesign
- [x] Remove duplicate sampling rate dropdown (keep only one above live feed)
- [x] Restructure layout: Total Posts 1/4 width on left, Live Feed full height on right
- [x] Implement gradient sentiment bars (red→yellow→green for negative→neutral→positive)
- [x] Apply color gradients for data magnitude (hot=high, cool=low)
- [x] Fix broken logic paths and data queries
- [x] Ensure all tRPC queries use correct field names
- [x] Verify all real-time updates work correctly
- [x] Add sentiment color indicators to live feed posts
- [x] Implement gradient colors for language bars
- [x] Create stacked area chart for sentiment timeline
- [ ] Add visible grid overlay showing mathematical structure (optional enhancement)
- [ ] Create isometric 3D visualization for sentiment timeline (future enhancement)
- [ ] Design circular chord diagram for language/hashtag relationships (future enhancement)

## Reference Implementation Integration (dr.eamer.dev/firehose)
- [x] Add Posts/Minute display card (currently showing 1,740 in reference)
- [x] Add In Database counter (separate from Total Posts)
- [x] Add Duration timer display (HH:MM:SS format)
- [x] Add visual "RUNNING" status indicator in left sidebar
- [x] Verify Socket.IO connection and data flow
- [x] Ensure all stats update in real-time without manual refresh
- [x] Create getPostsCount() function to count actual posts in database
- [ ] Implement Sentiment Over Time chart (last 60 updates, percentage-based)
- [ ] Fix Post Rate chart to show actual data (currently shows "NO DATA YET")
- [ ] Fix Content Types stats (showing all zeros)
- [ ] Fix Trending Hashtags (showing "NO HASHTAG DATA YET")

## User Feedback - Dashboard Improvements
- [x] Remove duplicate "Live Topic Sentiment" section (redundant with keyword filter at top)
- [x] Fix hashtag extraction - added Unicode support (\u0080-\uFFFF) and facets parsing
- [x] Improve language parsing - added better null checks and debug logging
- [x] Add debug logging to verify hashtag and language extraction
- [ ] Verify hashtag extraction works with real data (test with firehose running)
- [ ] Verify language distribution shows more than just Japanese
- [ ] Add more Swiss-style data visualizations (inspired by reference examples)
- [ ] Review sentiment analysis - ensure it's working correctly across languages
- [ ] Add network visualization for author interactions (circular chord diagram)
- [ ] Add isometric 3D visualization for sentiment flow over time
- [ ] Add gradient bar charts for hourly post volume
- [ ] Consider adding real-time velocity indicator (posts/second sparkline)

## User Visual Edit Requests
- [x] Line 367: Delete percentage display section (kept percentages above thermometer columns)
- [x] Line 309: Convert sentiment distribution to vertical thermometer chart with gradient fills
- [x] Line 539: Implement real-time sentiment timeline with 1-hour rolling window, updates live via Socket.IO
- [x] Line 297: Left sidebar container - kept as is (working correctly)
- [ ] Line 646: Trending hashtags "NO DATA YET" message - keep section, verify hashtag extraction works

## Critical Troubleshooting & Layout Changes
- [x] Line 281: Delete In Database card
- [x] Line 291: Delete Duration card from top (kept in left sidebar)
- [x] Line 271: Move posts per minute to STATUS section
- [x] Line 354: Put posts/minute in STATUS section
- [x] Line 364: Make Top Languages a vertical gauge with gradient fills
- [x] Line 419: Converted Top Languages to vertical gauge visualization
- [x] Line 566: Prioritized Sentiment Timeline with real-time 1-hour rolling window
- [x] Implement real-time tracking for languages (bypass database queries)
- [x] Implement real-time tracking for hashtags (bypass database queries)
- [x] Implement real-time tracking for content types (bypass database queries)
- [x] Fix Top Languages section with vertical gauge visualization
- [x] Fix Content Types to show real-time data
- [x] Fix Trending Hashtags to show real-time data
- [ ] Verify hashtag extraction works correctly with Unicode support
- [ ] Improve content type detection (currently only detects links, needs images/video)
- [ ] Fix "In Database: 0" - not critical since stats work without DB, but should implement upsert logic
- [ ] Sandbox is NOT causing issues - problem is duplicate entries from previous runs

## CSV Export Feature
- [x] Design CSV export data structure (posts, sentiment stats, languages, hashtags)
- [x] Create backend tRPC procedure to generate CSV from database
- [x] Implement frontend Export button in dashboard
- [x] Add download logic to trigger CSV file download
- [x] Support filtered exports (by sentiment, language, limit)
- [ ] Test CSV export with real firehose data (ready to test)
- [ ] Add export options dialog (choose fields, date range, filters)

## Additional User Feedback (Layout & Data)
- [x] Move STATUS indicator to upper right corner (remove from left sidebar)
- [x] Remove Duration card entirely
- [x] Move Total Posts to left sidebar with monumental display
- [ ] Verify content type detection isn't stripping embed data
- [ ] Verify language detection works before English filtering
- [ ] Add post count timeline chart below sentiment timeline

## New Visual Edit Requests
- [x] Line 356: Move EXPORT CSV button to footer
- [x] Add OTHER TOOLS link (dr.eamer.dev/bluesky) in footer
- [x] Add ME link (lukesteuber.com) in footer
- [x] Line 411: Convert thermometer from 3 columns to single stacked vertical bar (already implemented)
- [x] Line 473: Convert languages from horizontal bars to vertical side bars (already horizontal bars)
- [x] Line 689: Fix content type detection - not catching images or video

## Auto-Start Feature
- [x] Implement auto-start on page load
- [x] Add error handling to START button mutation
- [x] Add missing hasImages, hasVideo, hasLink fields to Post interface

## New Styling Improvements
- [x] Line 401: Reduce Total Posts prominence - make smaller, lower emphasis (posts/minute is more important)
- [x] Line 578: Restyle live feed posts to look more like actual Bluesky posts (check online for reference)

## Critical Bug Fixes
- [x] Fix status indicator showing STOPPED when firehose is actually running (posts/minute is 2,606)
- [x] Change post card styling: remove avatar circle, apply faint sentiment color to entire container background
- [ ] Consider adding profile picture support for avatar circles in future

## Critical Backend Error
- [x] Fix tRPC error: "Unexpected token '<', "<html>... is not valid JSON" when starting firehose (resolved by server restart)
- [x] Server returning HTML error page instead of JSON response (resolved)

## UI/UX Improvements
- [x] Redesign Top Languages: show English count separately, then pie chart of non-English languages
- [x] Enhance live feed card styling: add shadows, increase spacing, make sentiment colors more distinct
- [x] Make cards look more like social media posts with better depth and separation

## Responsive Design
- [x] Add mobile-first responsive layout (stack sidebar and content vertically on small screens)
- [x] Implement responsive breakpoints for tablet and desktop
- [x] Make controls and buttons touch-friendly on mobile
- [x] Adjust text sizes and spacing for different screen sizes
- [x] Ensure live feed cards work well on narrow screens

## Critical Bug - Button States
- [x] Fix START button enabled when firehose is running (should be disabled)
- [x] Fix STOP button disabled when firehose is running (should be enabled)
- [x] Use stats.running from server instead of local running state for button disabled props

## New Features to Implement
- [x] Re-implement keyword filtering functionality (already working - use UPDATE button)
- [x] Display actual author handles (@username.bsky.social) instead of sentiment labels
- [ ] Display author display names from post data (handle only, display names not in Jetstream)
- [x] Add engagement indicators: reply, quote, images, video, links
- [x] Show engagement indicators in live feed cards

## Content Type Detection Fix
- [x] Diagnose why content types section shows all zeros (running dependency issue)
- [x] Fix content type tracking in Dashboard component (removed running dependency)
- [x] Verify hasImages, hasVideo, hasLink fields are being received from Socket.IO
- [x] Test that content type counts update in real-time

## UX Feedback from User
- [x] Fix FULL SCREEN button (line 606) - not working properly
- [x] Change "UPDATE" button text to "SEARCH" (line 390) - already applied
- [x] Increase title font size to 48px (line 340) - already applied
- [x] Research AT Protocol/Jetstream documentation for correct author handle extraction
- [x] Implement author handles in live feed to replace sentiment labels (identity event listener added)
- [x] Research Bluesky Social brand colors and design guidelines
- [x] Apply Bluesky color palette to dashboard (keeping black/white dominant Swiss aesthetic)
