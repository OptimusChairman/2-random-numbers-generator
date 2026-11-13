import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

let openDialogs = 0;

/**
 * Keeps keyboard focus inside an open dialog: moves focus into it, wraps Tab and Shift+Tab at the
 * ends, and puts focus back where it was when the dialog closes. While a dialog is open the page
 * behind it does not scroll.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;

    openDialogs += 1;
    document.documentElement.classList.add("dialog-open");

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

    if (!node.contains(document.activeElement)) (items()[0] ?? node).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = items();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const current = document.activeElement;
      if (!node.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openDialogs -= 1;
      if (openDialogs <= 0) {
        openDialogs = 0;
        document.documentElement.classList.remove("dialog-open");
      }
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [active, ref]);
}
