import React from 'react';
import { motion } from 'motion/react';
import { getPageVariants } from '../../constants/motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/** Shared entrance/exit animation for every page (<=150ms, respects prefers-reduced-motion). */
export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => (
  <motion.div
    variants={getPageVariants()}
    initial="initial"
    animate="animate"
    exit="exit"
    className={className}
  >
    {children}
  </motion.div>
);
