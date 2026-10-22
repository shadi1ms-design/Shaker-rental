/**
 * Unified animation and transition configurations for Shaker Car Rental.
 * Optimized specifically for 60fps mobile performance:
 * - Only animates transform (y, scale) and opacity.
 * - Zero heavy blur filters or dynamic shadow animations.
 * - Respects prefers-reduced-motion with instant transitions.
 */

// Detect reduced motion preference on client
export const isPrefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// 1. Unified Page Entrance & Exit Transition (0.35s easeOut, translateY 16px -> 0, opacity 0 -> 1)
export const pageTransitionVariants = {
  initial: {
    opacity: 0,
    y: 16,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1], // Smooth easeOut cubic-bezier
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

// Instant transition for users with reduced motion enabled
export const reducedPageTransitionVariants = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0, transition: { duration: 0 } },
  exit: { opacity: 1, y: 0, transition: { duration: 0 } },
};

// 2. Staggered Container for Lists & Grids (0.05s between children)
export const staggerContainerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

// 3. Staggered Item
export const staggerItemVariants = {
  initial: {
    opacity: 0,
    y: 16,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// 4. Subtle tap/click feedback (scale: 0.97)
export const cardTapAnimation = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.97 },
  transition: { duration: 0.12, ease: 'easeOut' },
};

export const buttonTapAnimation = {
  whileTap: { scale: 0.97 },
  transition: { duration: 0.1, ease: 'easeOut' },
};

// Helper to get active page variants based on reduced motion setting
export function getPageVariants() {
  return isPrefersReducedMotion() ? reducedPageTransitionVariants : pageTransitionVariants;
}

export function getStaggerVariants() {
  return isPrefersReducedMotion()
    ? {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
      }
    : staggerContainerVariants;
}

export function getItemVariants() {
  return isPrefersReducedMotion()
    ? {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
      }
    : staggerItemVariants;
}
