import { Fragment, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** True once the element has scrolled into view (stays true). Reduced-motion users get it immediately. */
export function useInView<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T>(null);
  // Reduced-motion users (and browsers without IntersectionObserver) see everything straight away.
  const [seen, setSeen] = useState(() => reducedMotion() || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

/** Fades and slides its children in when scrolled into view. ``delay`` staggers siblings (in steps of 90ms). */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={`reveal ${seen ? "is-visible" : ""} ${className}`.trim()} style={{ "--i": delay } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** A number that counts up once when it scrolls into view. */
export function CountUp({ value, duration = 1400 }: { value: number; duration?: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.4);
  const reduced = reducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!seen || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, reduced, value, duration]);
  return <span ref={ref}>{(reduced ? value : shown).toLocaleString("en-US")}</span>;
}

/** Splits a headline into words that rise in one after another. */
export function WordReveal({ text, className = "", start = 0 }: { text: string; className?: string; start?: number }) {
  return (
    <span className={`words ${className}`.trim()} aria-label={text}>
      {text.split(" ").map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="word-mask" aria-hidden="true">
            <span className="word" style={{ "--i": start + index } as CSSProperties}>
              {word}
            </span>
          </span>{" "}
        </Fragment>
      ))}
    </span>
  );
}

/** 0-1 of how far the page is scrolled; drives the thin progress line at the top. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return progress;
}
