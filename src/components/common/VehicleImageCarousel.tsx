import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Vehicle } from '../../types';
import { VehicleImagePlaceholder } from '../VehicleImagePlaceholder';

interface VehicleImageCarouselProps {
  vehicle: Pick<Vehicle, 'id' | 'brand' | 'model' | 'imageUrl' | 'images'>;
  /** Tailwind aspect/height classes for the frame. */
  className?: string;
  /** Badges / overlays placed on top of the image (kept outside the swipe area). */
  children?: React.ReactNode;
}

/**
 * Swipeable image gallery for vehicle cards.
 * - Native scroll-snap: swipe on touch, drag/scroll on desktop, arrows on hover-capable screens.
 * - No dark overlay on the photo: the picture stays at full clarity.
 * - Works with a single image (no controls) or none (placeholder).
 */
export const VehicleImageCarousel: React.FC<VehicleImageCarouselProps> = ({
  vehicle,
  className = 'aspect-[4/3] sm:aspect-[16/10]',
  children,
}) => {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const images = useMemo(() => {
    const all = [vehicle.imageUrl, ...(vehicle.images ?? [])].filter((u): u is string => Boolean(u));
    return Array.from(new Set(all)).filter((u) => !failed[u]);
  }, [vehicle.imageUrl, vehicle.images, failed]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }, []);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  const multiple = images.length > 1;
  const current = Math.min(index, images.length - 1);

  return (
    <div className={`relative w-full bg-slate-950 overflow-hidden ${className}`}>
      {images.length === 0 ? (
        <VehicleImagePlaceholder brand={vehicle.brand} model={vehicle.model} />
      ) : (
        // dir="ltr" keeps scroll math identical in every browser; slide order = image order.
        <div
          ref={scrollerRef}
          dir="ltr"
          onScroll={handleScroll}
          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain' }}
          role="group"
          aria-roledescription="carousel"
          aria-label={`صور ${vehicle.brand} ${vehicle.model}`}
        >
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${vehicle.brand} ${vehicle.model} - صورة ${i + 1} من ${images.length}`}
              width={800}
              height={600}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="w-full h-full shrink-0 snap-center object-cover select-none"
              onError={() => setFailed((prev) => ({ ...prev, [src]: true }))}
            />
          ))}
        </div>
      )}

      {/* Overlays: pointer-events-none so swiping works everywhere on the photo */}
      <div className="absolute inset-0 pointer-events-none">{children}</div>

      {multiple && (
        <>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-slate-950/70 text-white border border-white/20 hover:bg-slate-950 disabled:opacity-0 transition-all cursor-pointer"
            aria-label="الصورة السابقة"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === images.length - 1}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-slate-950/70 text-white border border-white/20 hover:bg-slate-950 disabled:opacity-0 transition-all cursor-pointer"
            aria-label="الصورة التالية"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5" dir="ltr">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`الانتقال إلى الصورة ${i + 1}`}
                aria-current={i === current}
                className="p-1.5 cursor-pointer"
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
