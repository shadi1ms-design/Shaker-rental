import React, { useEffect, useRef } from 'react';
import { navigate, useLocation, type NavigateOptions } from '../../router';
import { prefetchRoute } from '../../utils/lazyWithRetry';

const HOVER_PREFETCH_DELAY_MS = 100;

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
}

function normalizePath(path: string): string {
  const stripped = path.split(/[?#]/)[0].replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

/**
 * Unified internal SPA navigation link wrapping a native <a href>.
 * Preserves browser features (Ctrl/Cmd+Click, middle click, Shift+Click, target="_blank", Open in New Tab),
 * automatically sets aria-current="page" when the current pathname matches `to`,
 * and optionally prefetches the target route chunk on hover/focus (after 100ms) or mobile viewport entry.
 */
export const Link: React.FC<LinkProps> = ({
  to,
  replace,
  scroll,
  prefetch = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  target,
  'aria-current': ariaCurrentProp,
  children,
  ...rest
}) => {
  const { pathname } = useLocation();
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasHash = to.includes('#');
  const isCurrentPath = !hasHash && normalizePath(to) === pathname;
  const resolvedAriaCurrent =
    ariaCurrentProp !== undefined ? ariaCurrentProp : isCurrentPath ? 'page' : undefined;

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const schedulePrefetch = () => {
    if (!prefetch || isCurrentPath) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      prefetchRoute(to);
    }, HOVER_PREFETCH_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // Mobile viewport prefetch via IntersectionObserver
  useEffect(() => {
    if (!prefetch || isCurrentPath || typeof window === 'undefined') return;
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const isMobileOrTouch = window.matchMedia?.(
      '(hover: none), (pointer: coarse), (max-width: 768px)'
    ).matches;
    if (!isMobileOrTouch) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            prefetchRoute(to);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '120px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [prefetch, isCurrentPath, to]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(e);
    schedulePrefetch();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseLeave?.(e);
    clearHoverTimer();
  };

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(e);
    schedulePrefetch();
  };

  const handleBlur = (e: React.FocusEvent<HTMLAnchorElement>) => {
    onBlur?.(e);
    clearHoverTimer();
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    clearHoverTimer();
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      (target && target !== '_self')
    ) {
      return;
    }

    e.preventDefault();
    const navOptions: NavigateOptions = { replace, scroll };
    navigate(to, navOptions);
  };

  return (
    <a
      ref={anchorRef}
      href={to}
      target={target}
      aria-current={resolvedAriaCurrent}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    >
      {children}
    </a>
  );
};
