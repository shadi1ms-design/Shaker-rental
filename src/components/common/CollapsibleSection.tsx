import React, { useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { isPrefersReducedMotion } from '../../constants/motion';

interface CollapsibleSectionProps {
  id?: string;
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  icon,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  children,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    if (onToggle) onToggle(next);
  };

  const autoId = useId();
  const contentId = `collapsible-${id || autoId}`;
  const reducedMotion = isPrefersReducedMotion();

  return (
    <div id={id} className={`bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-card overflow-hidden transition-all shadow-md ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-3 text-start text-white font-bold text-sm sm:text-base hover:bg-slate-800/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <h2 className="inline font-bold text-inherit">{title}</h2>
        </div>
        <span className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/70 flex items-center justify-center shrink-0">
          <ChevronDown
            className={`w-5 h-5 text-amber-400 transition-transform ${reducedMotion ? '' : 'duration-300'} ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      <div
        id={contentId}
        className={`grid transition-[grid-template-rows] ${reducedMotion ? '' : 'duration-300 ease-in-out'} ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-6 pt-0 text-slate-300 space-y-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
