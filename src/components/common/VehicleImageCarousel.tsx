import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Vehicle } from '../../types';
import { VehicleImagePlaceholder } from './VehicleImagePlaceholder';
import { isPrefersReducedMotion } from '../../constants/motion';

interface VehicleImageCarouselProps {
  vehicle: Pick<Vehicle, 'id' | 'brand' | 'model' | 'imageUrl' | 'images'>;
  /** Tailwind aspect/height classes for the frame. */
  className?: string;
  /** Badges / overlays placed on top of the image (kept outside the swipe area). */
  children?: React.ReactNode;
}

/**
 * Swipeable RTL-native image gallery for vehicle cards.
 * - Uses dir="rtl" so slide 0 starts on the right and Next advances leftwards.
 * - Next button sits on the left (end-2) pointing left (<ChevronLeft />).
 * - Prev button sits on the right (start-2) pointing right (<ChevronRight />).
 * - Uses IntersectionObserver + scroll tracking to keep dot state accurate in all browsers.
 */
export const VehicleImageCarousel: React.FC<VehicleImageCarouselProps> = ({
  vehicle,
  className = 'aspect-[4/3] sm:aspect-[16/10]',
  children,
}) => {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const images = useMemo(() => {
    const all = [vehicle.imageUrl, ...(vehicle.images ?? [])].filter((u): u is string => Boolean(u));
    return Array.from(new Set(all)).filter((u) => !failed[u]);
  }, [vehicle.imageUrl, vehicle.images, failed]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || images.length <= 1 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idxAttr = entry.target.getAttribute('data-slide-idx');
            if (idxAttr !== null) {
              const parsed = Number(idxAttr);
              if (Number.isFinite(parsed)) setIndex(parsed);
            }
          }
        }
      },
      { root, threshold: 0.6 }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [images]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const derived = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    setIndex(Math.max(0, Math.min(images.length - 1, derived)));
  }, [images.length]);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(images.length - 1, i));
    const behavior: ScrollBehavior = isPrefersReducedMotion() ? 'auto' : 'smooth';
    // In dir="rtl", scrollLeft is 0 at slide 0 (start/right) and negative toward the left.
    const isRtl = typeof window !== 'undefined' && getComputedStyle(el).direction === 'rtl';
    el.scrollTo({
      left: isRtl ? -next * el.clientWidth : next * el.clientWidth,
      behavior,
    });
    setIndex(next);
  };

  const multiple = images.length > 1;
  const current = Math.min(index, Math.max(0, images.length - 1));

  return (
    <div className={`relative w-full bg-slate-950 overflow-hidden ${className}`}>
      {images.length === 0 ? (
        <VehicleImagePlaceholder brand={vehicle.brand} model={vehicle.model} />
      ) : (
        <div
          ref={scrollerRef}
          dir="rtl"
          onScroll={handleScroll}
          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain' }}
          role="group"
          aria-roledescription="carousel"
          aria-label={`صور ${vehicle.brand} ${vehicle.model}`}
        >
          {images.map((src, i) => (
            <div
              key={src}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              data-slide-idx={i}
              className="relative w-full h-full shrink-0 snap-center overflow-hidden flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900"
            >
              <img
                src={src}
                alt={`${vehicle.brand} ${vehicle.model} - صورة ${i + 1} من ${images.length}`}
                width={800}
                height={600}
                sizes="(max-width: 768px) 92vw, (max-width: 1280px) 45vw, 380px"
                loading="lazy"
                decoding="async"
                draggable={false}
                className="relative z-10 w-full h-full object-contain p-2 select-none"
                onError={() => setFailed((prev) => ({ ...prev, [src]: true }))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Overlays: pointer-events-none so swiping works everywhere on the photo */}
      <div className="absolute inset-0 pointer-events-none">{children}</div>

      {multiple && (
        <>
          {/* Previous slide: on the RIGHT (start in RTL), points RIGHT */}
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="hidden sm:inline-flex absolute start-1.5 top-1/2 -translate-y-1/2 min-w-11 min-h-11 items-center justify-center text-white disabled:opacity-0 disabled:pointer-events-none transition-opacity cursor-pointer z-10"
            aria-label="الصورة السابقة"
          >
            <span className="w-9 h-9 rounded-full bg-slate-950/75 border border-white/20 hover:bg-slate-950 flex items-center justify-center shadow-md">
              <ChevronRight className="w-5 h-5" />
            </span>
          </button>

          {/* Next slide: on the LEFT (end in RTL), points LEFT */}
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === images.length - 1}
            className="hidden sm:inline-flex absolute end-1.5 top-1/2 -translate-y-1/2 min-w-11 min-h-11 items-center justify-center text-white disabled:opacity-0 disabled:pointer-events-none transition-opacity cursor-pointer z-10"
            aria-label="الصورة التالية"
          >
            <span className="w-9 h-9 rounded-full bg-slate-950/75 border border-white/20 hover:bg-slate-950 flex items-center justify-center shadow-md">
              <ChevronLeft className="w-5 h-5" />
            </span>
          </button>

          <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-0.5 z-10" dir="rtl">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`الانتقال إلى الصورة ${i + 1}`}
                aria-current={i === current}
                className="min-h-11 min-w-11 inline-flex items-center justify-center cursor-pointer"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    i === current ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/70'
                  } shadow-[0_0_3px_rgba(0,0,0,0.7)]`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
