import React from 'react';
import { motion } from 'motion/react';
import { getPageVariants } from '../../constants/motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/** Shared entrance animation for every page. Give it a `key` at the call site to replay it. */
export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => (
  <motion.div variants={getPageVariants()} initial="initial" animate="animate" exit="exit" className={className}>
    {children}
  </motion.div>
);
