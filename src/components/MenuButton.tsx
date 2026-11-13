import React from 'react';
import { Menu, X } from 'lucide-react';
import { useMenu } from '../contexts/MenuContext';

interface MenuButtonProps {
  className?: string;
}

/**
 * Unified ☰ Menu button used in Navbar and PageTopBar.
 * Replaces the yellow car logo square with the exact same dimensions (${className || 'w-12 h-12'} rounded-xl),
 * amber gradient, and rounded design.
 */
export const MenuButton: React.FC<MenuButtonProps> = ({ className = 'w-11 h-11' }) => {
  const { isOpen, toggleMenu } = useMenu();

  return (
    <button
      type="button"
      onClick={toggleMenu}
      className={`${className} rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-200 hover:text-amber-400 flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
      aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة الرئيسية'}
      aria-expanded={isOpen}
      title="القائمة الرئيسية"
      id="unified-menu-button"
    >
      {isOpen ? (
        <X className="w-5 h-5" />
      ) : (
        <Menu className="w-5 h-5" />
      )}
    </button>
  );
};
