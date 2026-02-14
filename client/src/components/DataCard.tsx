/**
 * DataCard.tsx - Collapsible/Pinnable Card for Data Visualizations
 *
 * Swiss Design aesthetic: Black/white palette, Helvetica, 8px grid, uppercase tracking
 * Features: Collapse/expand, pin state, smooth transitions
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DataCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
  defaultPinned?: boolean;
  onTogglePin?: (pinned: boolean) => void;
}

export function DataCard({
  title,
  children,
  className = '',
  defaultExpanded = false,
  defaultPinned = false,
  onTogglePin,
}: DataCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pinned, setPinned] = useState(defaultPinned);

  const handleToggleExpand = () => {
    if (!pinned) {
      setExpanded(!expanded);
    }
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = !pinned;
    setPinned(newPinned);
    if (newPinned) {
      setExpanded(true);
    }
    onTogglePin?.(newPinned);
  };

  return (
    <motion.div
      layout
      className={`border-2 border-foreground bg-background overflow-hidden ${className}`}
      style={{
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
      initial={false}
      animate={{
        opacity: 1,
      }}
      transition={{
        layout: { duration: 0.3, ease: 'easeInOut' },
      }}
    >
      {/* Header - Always visible */}
      <div
        onClick={handleToggleExpand}
        className={`px-4 py-3 border-b-2 border-foreground flex items-center justify-between ${
          !pinned ? 'cursor-pointer hover:bg-foreground/5' : ''
        } transition-colors`}
      >
        <h3 className="text-xs font-bold uppercase tracking-widest flex-1">
          {title}
        </h3>

        <div className="flex items-center gap-2">
          {/* Pin Button */}
          <button
            onClick={handleTogglePin}
            className={`p-1.5 transition-all ${
              pinned
                ? 'text-foreground'
                : 'text-foreground/30 hover:text-foreground/60'
            }`}
            title={pinned ? 'Unpin (allow collapse)' : 'Pin (keep expanded)'}
            aria-label={pinned ? 'Unpin card' : 'Pin card'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={pinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
            </svg>
          </button>

          {/* Expand/Collapse Indicator */}
          {!pinned && (
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-foreground/60"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content - Collapsible */}
      <AnimatePresence initial={false}>
        {(expanded || pinned) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: 'easeInOut' },
              opacity: { duration: 0.2 },
            }}
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
