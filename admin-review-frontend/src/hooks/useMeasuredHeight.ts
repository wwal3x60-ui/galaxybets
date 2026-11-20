"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Measures the height of the element attached to the returned ref.
 * Updates when the element resizes (ResizeObserver).
 * Use to constrain a sibling (e.g. sidebar) to the same height as the main content.
 * Uses a callback ref so measurement works when the element mounts after conditional render (e.g. after loading).
 *
 * @returns [ref, height] - Attach ref to the element to measure; height is in px or 0 before mount.
 */
export function useMeasuredHeight(): [
  (node: HTMLDivElement | null) => void,
  number,
] {
  const [height, setHeight] = useState(0);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  const refCallback = useCallback((el: HTMLDivElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    const update = () => setHeight(node.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(update);
    });
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [node]);

  return [refCallback, height];
}
