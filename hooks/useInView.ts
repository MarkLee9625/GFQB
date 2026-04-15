import { useEffect, useRef, useState, useMemo } from 'react';

export function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  const stableOptions = useMemo(() => ({
    root: options?.root,
    rootMargin: options?.rootMargin,
    threshold: options?.threshold
  }), [options?.root, options?.rootMargin, options?.threshold]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, stableOptions);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [stableOptions]);

  return { ref, inView };
}
