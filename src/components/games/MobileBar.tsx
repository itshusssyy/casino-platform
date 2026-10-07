"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/**
 * Bottom action bar for phones. Rendered into <body> through a portal, because game panels use
 * backdrop-filter, which would otherwise pin "position: fixed" to the panel instead of the screen.
 */
export function MobileBar({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <>
      <div className="h-28 sm:hidden" aria-hidden />
      {mounted &&
        createPortal(
          <div
            data-mobile-bar
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
