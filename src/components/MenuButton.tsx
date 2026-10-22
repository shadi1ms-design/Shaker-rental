import React from 'react';
import { Menu, X } from 'lucide-react';
import { useMenu } from '../contexts/MenuContext';

interface MenuButtonProps {
  className?: string;
}

/**
 * Unified ☰ Menu button used in Navbar and PageTopBar.
 * Replaces the yellow car logo square with the exact same dimensions (w-12 h-12 rounded-xl),
 * amber gradient, and rounded design.
 */
export const MenuButton: React.FC<MenuButtonProps> = ({ className = '' }) => {
  const { isOpen, toggleMenu } = useMenu();

  return (
    <button
      type="button"
      onClick={toggleMenu}
      className={`w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${className}`}
      aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة الرئيسية'}
      aria-expanded={isOpen}
      title="القائمة الرئيسية"
      id="unified-menu-button"
    >
      {isOpen ? (
        <X className="w-6 h-6 stroke-[2.5]" />
      ) : (
        <Menu className="w-6 h-6 stroke-[2.5]" />
      )}
    </button>
  );
};
