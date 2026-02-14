/**
 * MediaDisplay.tsx - Shared media display component
 *
 * Handles inline images, video thumbnails, and galleries
 */

import { useState } from 'react';
import type { MediaItem } from '../pages/variants/types';

interface MediaDisplayProps {
  images?: MediaItem[];
  videos?: MediaItem[];
  variant?: 'compact' | 'standard' | 'large';
  className?: string;
  sensitive?: boolean;
}

export function MediaDisplay({ images = [], videos = [], variant = 'standard', className = '', sensitive = false }: MediaDisplayProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);

  const allMedia = [...images, ...videos];

  if (allMedia.length === 0) return null;

  // Blur sensitive content by default
  const blurClass = sensitive && !showSensitive ? 'blur-xl' : '';

  const sizes = {
    compact: 'h-24',
    standard: 'h-48',
    large: 'h-64'
  };

  return (
    <>
      <div className={`media-display relative ${className}`}>
        {/* Sensitive Content Warning Overlay */}
        {sensitive && !showSensitive && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded cursor-pointer"
            onClick={() => setShowSensitive(true)}
          >
            <div className="text-center p-4">
              <div className="text-white font-semibold mb-2">⚠️ Sensitive Content</div>
              <button className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition text-sm">
                Click to Show
              </button>
            </div>
          </div>
        )}

        {/* Single Image */}
        {images.length === 1 && videos.length === 0 && (
          <img
            src={images[0].url}
            alt={images[0].alt || 'Post image'}
            className={`w-full ${sizes[variant]} object-cover rounded cursor-pointer hover:opacity-90 transition ${blurClass}`}
            onClick={() => !sensitive || showSensitive ? setLightboxImage(images[0].url) : setShowSensitive(true)}
            loading="lazy"
          />
        )}

        {/* Single Video */}
        {videos.length === 1 && images.length === 0 && (
          <div className="relative">
            <img
              src={videos[0].thumbnail || videos[0].url}
              alt="Video thumbnail"
              className={`w-full ${sizes[variant]} object-cover rounded ${blurClass}`}
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
              <div className="w-12 h-12 flex items-center justify-center bg-white/90 rounded-full">
                <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Multiple Media - Gallery */}
        {allMedia.length > 1 && (
          <div className="grid grid-cols-2 gap-2">
            {allMedia.slice(0, 4).map((media, index) => (
              <div key={index} className="relative">
                {media.type === 'image' ? (
                  <>
                    <img
                      src={media.url}
                      alt={media.alt || `Image ${index + 1}`}
                      className={`w-full ${variant === 'large' ? 'h-48' : 'h-32'} object-cover rounded cursor-pointer hover:opacity-90 transition ${blurClass}`}
                      onClick={() => !sensitive || showSensitive ? setLightboxImage(media.url) : setShowSensitive(true)}
                      loading="lazy"
                    />
                    {/* More indicator on 4th image */}
                    {index === 3 && allMedia.length > 4 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded">
                        <span className="text-white text-2xl font-bold">
                          +{allMedia.length - 4}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative">
                    <img
                      src={media.thumbnail || media.url}
                      alt={`Video ${index + 1}`}
                      className={`w-full ${variant === 'large' ? 'h-48' : 'h-32'} object-cover rounded ${blurClass}`}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
                      <div className="w-10 h-10 flex items-center justify-center bg-white/90 rounded-full">
                        <svg className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 transition"
            onClick={() => setLightboxImage(null)}
          >
            ×
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
