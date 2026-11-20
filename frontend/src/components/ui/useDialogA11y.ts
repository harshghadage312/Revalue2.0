import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;
const stack: symbol[] = [];

/**
 * Shared accessibility behaviour for modal dialogs:
 * Escape to close, focus trapping, focus restore, and body scroll lock.
 * Purely presentational — it never changes what the dialog does.
 */
export function useDialogA11y<T extends HTMLElement>(
  isOpen: boolean,
  onClose: (() => void) | undefined,
  options: { initialFocus?: 'first' | 'container' | 'none'; closeOnEscape?: boolean } = {}
) {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { initialFocus = 'first', closeOnEscape = true } = options;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const token = Symbol('dialog');
    stack.push(token);
    openCount += 1;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const node = ref.current;
    if (node && initialFocus !== 'none') {
      requestAnimationFrame(() => {
        if (!node.isConnected) return;
        // Respect elements that already grabbed focus (e.g. autoFocus inputs)
        if (node.contains(document.activeElement)) return;
        if (initialFocus === 'first') {
          const el = node.querySelector<HTMLElement>('[data-autofocus]') || node.querySelector<HTMLElement>(FOCUSABLE);
          (el || node).focus({ preventScroll: true });
        } else {
          node.focus({ preventScroll: true });
        }
      });
    }

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return; // only the top-most dialog reacts
      if (e.key === 'Escape' && closeOnEscape && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null || el === document.activeElement
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      const idx = stack.lastIndexOf(token);
      if (idx >= 0) stack.splice(idx, 1);
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = prevOverflow === 'hidden' ? '' : prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen, initialFocus, closeOnEscape]);

  return ref;
}
