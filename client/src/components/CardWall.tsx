/**
 * CardWall.tsx - Masonry-style Grid Layout for Data Cards
 *
 * Responsive grid that adapts to screen size:
 * - Mobile: 1 column
 * - Tablet: 2 columns
 * - Desktop: 3 columns
 * - Wide: 4 columns
 */

import { ReactNode } from 'react';

interface CardWallProps {
  children: ReactNode;
  className?: string;
}

export function CardWall({ children, className = '' }: CardWallProps) {
  return (
    <div
      className={`grid gap-4 auto-rows-max ${className}`}
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
      }}
    >
      {children}
    </div>
  );
}
