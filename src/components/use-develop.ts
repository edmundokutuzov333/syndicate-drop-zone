import { useEffect, useRef } from "react";

export function useDevelop<T extends HTMLElement>(delayMs = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (document.documentElement.hasAttribute("data-lite")) {
      el.dataset.dev = "1";
      return;
    }

    let timer: number | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        timer = window.setTimeout(() => {
          el.dataset.dev = "1";
        }, delayMs);
        io.disconnect();
      },
      { threshold: 0.3, rootMargin: "80px" },
    );

    io.observe(el);

    return () => {
      io.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [delayMs]);

  return ref;
}
