import { useEffect, useRef, RefObject } from 'react';

export interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  trapTab?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  closeOnEsc?: boolean;
  lockScroll?: boolean;
  disabled?: boolean;
}

let activeScrollLocksCount = 0;

function incrementScrollLock() {
  activeScrollLocksCount++;
  if (activeScrollLocksCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

function decrementScrollLock() {
  if (activeScrollLocksCount > 0) {
    activeScrollLocksCount--;
    if (activeScrollLocksCount === 0) {
      document.body.style.overflow = '';
    }
  }
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions
): RefObject<T | null>;

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  containerRef: RefObject<T | null>,
  options: UseFocusTrapOptions
): void;

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  arg1: RefObject<T | null> | UseFocusTrapOptions,
  arg2?: UseFocusTrapOptions
): RefObject<T | null> | void {
  const internalRef = useRef<T>(null);

  const isRefPassed = Boolean(arg1 && 'current' in arg1);
  const containerRef = isRefPassed
    ? (arg1 as RefObject<T | null>)
    : internalRef;
  const options = isRefPassed ? arg2! : (arg1 as UseFocusTrapOptions);

  const {
    isOpen,
    onClose,
    trapTab = true,
    autoFocus = true,
    closeOnEsc = true,
    lockScroll = false, // DEFAULT TO FALSE per User Request 1
    disabled = false,
  } = options || {};

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Lock scroll module-level counter
  useEffect(() => {
    if (!isOpen || disabled || !lockScroll) return;
    incrementScrollLock();
    return () => {
      decrementScrollLock();
    };
  }, [isOpen, disabled, lockScroll]);

  // One-time auto-focus on open
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !disabled && !wasOpenRef.current && autoFocus) {
      wasOpenRef.current = true;
      const timer = setTimeout(() => {
        if (containerRef.current) {
          const firstFocusable = containerRef.current.querySelector<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, disabled, autoFocus, containerRef]);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isOpen || disabled) return;
    const previousFocusedElement = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        if (onCloseRef.current) {
          e.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (trapTab && e.key === 'Tab' && containerRef.current) {
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !containerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !containerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
        previousFocusedElement.focus();
      }
    };
  }, [isOpen, disabled, trapTab, closeOnEsc, containerRef]);

  if (!isRefPassed) {
    return internalRef;
  }
}
