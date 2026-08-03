import { useEffect, useRef, useState } from 'react';

/**
 * 共享 IntersectionObserver
 *
 * 长文多图时每张图片各建一个 observer 本身就是滚动卡顿的来源之一。
 * 这里改为模块级单例 observer + 元素回调注册表，hook API 与原先一致。
 * 当前应用内唯一调用方是图片块（rootMargin 50px / threshold 0.01），
 * 因此共享实例固定使用这组参数。
 */

const SHARED_OPTIONS: IntersectionObserverInit = {
  rootMargin: '50px',
  threshold: 0.01,
};

type InViewCallback = (inView: boolean) => void;

let sharedObserver: IntersectionObserver | null = null;
const elementCallbacks = new Map<Element, Set<InViewCallback>>();

function getSharedObserver(): IntersectionObserver | null {
  if (sharedObserver) return sharedObserver;
  if (typeof IntersectionObserver === 'undefined') return null;
  try {
    sharedObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const callbacks = elementCallbacks.get(entry.target);
        if (!callbacks) continue;
        for (const callback of callbacks) {
          callback(entry.isIntersecting);
        }
      }
    }, SHARED_OPTIONS);
    return sharedObserver;
  } catch {
    return null;
  }
}

function observeElement(element: Element, callback: InViewCallback): () => void {
  const observer = getSharedObserver();
  let callbacks = elementCallbacks.get(element);
  if (!callbacks) {
    callbacks = new Set();
    elementCallbacks.set(element, callbacks);
  }
  callbacks.add(callback);
  observer?.observe(element);

  return () => {
    const set = elementCallbacks.get(element);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) {
      observer?.unobserve(element);
      elementCallbacks.delete(element);
      if (observer && elementCallbacks.size === 0) {
        observer.disconnect();
        sharedObserver = null;
      }
    }
  };
}

export function useInView(_options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return observeElement(element, setInView);
  }, []);

  return { ref, inView };
}
