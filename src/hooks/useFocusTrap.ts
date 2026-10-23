import { useEffect, useRef } from 'react';

interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Keep Tab inside the container (default). Pass false when the "modal" is rendered as a full page,
   * so keyboard users can still reach the site header and menu.
   */
  trapTab?: boolean;
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  initialFocusRef,
  trapTab = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Keep the latest callback / ref without re-running the effect. Callers usually pass an inline
  // arrow for onClose, which changes on every parent render; re-running the effect would move the
  // focus back to the first field while the user is typing.
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);
  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRefRef.current = initialFocusRef;
  });

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusInitial = () => {
      const initialRef = initialFocusRefRef.current;
      if (initialRef?.current) {
        initialRef.current.focus();
      } else {
        const firstFocusable = container.querySelector<HTMLElement>(focusableSelectors);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          container.focus();
        }
      }
    };

    const timer = setTimeout(focusInitial, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const close = onCloseRef.current;
        if (close) {
          event.stopPropagation();
          close();
        }
        return;
      }

      if (event.key !== 'Tab' || !trapTab) return;

      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter((el) => el.offsetParent !== null && !el.hasAttribute('disabled'));

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement || document.activeElement === container) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, trapTab]);

  return containerRef;
}
