import { useRef, useState, useEffect, useCallback } from 'react';

export interface UsePanZoomOptions {
  // 初始状态
  initialScale: number;
  initialX: number;
  initialY: number;
  
  // 配置
  isEditable: boolean;
  mode: 'edit' | 'read' | 'print';
  category: string;  // 用于检查是否是封面/封底
  
  // 回调
  onUpdate?: (updates: { scale?: number; posX?: number; posY?: number }) => void;
  onUpdateComplete?: (updates: { scale?: number; posX?: number; posY?: number }) => void;
  
  // 约束
  minScale?: number;
  maxScale?: number;
  scaleStep?: number;
  dragThreshold?: number; // 拖拽移动阈值，避免误触
  debounceDelay?: number; // 缩放防抖延迟
}

export interface UsePanZoomReturn {
  // 状态
  zoom: { scale: number; x: number; y: number };
  isDragging: boolean;
  
  // 事件处理器（用于直接绑定到 DOM 元素）
  eventHandlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
  };
  
  // DOM 引用
  containerRef: React.RefObject<HTMLDivElement | null>;
  
  // 其他
  setZoom: (zoom: { scale?: number; x?: number; y?: number }) => void;
  resetZoom: () => void;
}

/**
 * 拖拽和缩放管理 Hook
 * 
 * 功能特性：
 * 1. 拖拽移动（支持鼠标事件）
 * 2. 滚轮缩放（支持防抖更新）
 * 3. 全局事件防粘连（防止鼠标移出后状态卡住）
 * 4. 更新触发优化（拖拽结束时触发，缩放防抖触发）
 * 
 * 使用示例：
 * ```tsx
 * const { zoom, isDragging, eventHandlers, containerRef } = usePanZoom({
 *   initialScale: article.scale || 1,
 *   initialX: article.posX || 0,
 *   initialY: article.posY || 0,
 *   isEditable: mode === 'edit',
 *   mode,
 *   category: article.category,
 *   onUpdate: (updates) => onUpdate?.(article.id, updates),
 *   minScale: 0.5,
 *   maxScale: 5,
 * });
 * 
 * return (
 *   <div
 *     ref={containerRef}
 *     id={`cover-${article.id}`} // 可选，用于 CSS 选择器等
 *     {...eventHandlers}
 *   >
 *     {/* 内容 *\/}
 *   </div>
 * );
 * ```
 */
export function usePanZoom(options: UsePanZoomOptions): UsePanZoomReturn {
  const {
    initialScale,
    initialX,
    initialY,
    isEditable,
    mode,
    category,
    onUpdate,
    onUpdateComplete,
    minScale = 0.5,
    maxScale = 5,
    scaleStep: _scaleStep = 0.1,
    dragThreshold = 2,
    debounceDelay = 150,
  } = options;

  // 状态管理
  const [zoom, setZoomState] = useState({
    scale: initialScale,
    x: initialX,
    y: initialY,
  });
  const [isDragging, setIsDragging] = useState(false);

  const zoomRef = useRef(zoom);
  const isDraggingRef = useRef(isDragging);
  const dragStartRef = useRef({ x: 0, y: 0, initX: 0, initY: 0 });
  const hasMovedRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onUpdateCompleteRef = useRef(onUpdateComplete);
  onUpdateCompleteRef.current = onUpdateComplete;
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasUserInteractedRef = useRef(false);

  const setZoomWithRef = useCallback((updater: (prev: typeof zoom) => typeof zoom) => {
    setZoomState(prev => {
      const next = updater(prev);
      zoomRef.current = next;
      return next;
    });
  }, []);

  const setIsDraggingWithRef = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setIsDragging(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      isDraggingRef.current = next;
      return next;
    });
  }, []);

  // 拖拽事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditable || (category !== '封面' && category !== '封底')) return;
    if ((e.target as HTMLElement).closest('button, input, .clickable-area')) return;

    hasUserInteractedRef.current = true;
    setIsDraggingWithRef(true);
    hasMovedRef.current = false;
    dragStartRef.current = { 
      x: e.clientX, 
      y: e.clientY, 
      initX: zoomRef.current.x, 
      initY: zoomRef.current.y 
    };
  }, [isEditable, category]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      hasMovedRef.current = true;
    }
    
    setZoomWithRef(prev => ({
      ...prev,
      x: dragStartRef.current.initX + dx,
      y: dragStartRef.current.initY + dy,
    }));
  }, [isDragging, dragThreshold]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      setIsDraggingWithRef(false);
      
      if (hasMovedRef.current && onUpdateRef.current) {
        const updates = { 
          posX: zoomRef.current.x, 
          posY: zoomRef.current.y 
        };
        onUpdateRef.current(updates);
        onUpdateCompleteRef.current?.(updates);
      }
    }
  }, []);

  // 全局拖拽事件防粘连
  useEffect(() => {
    if (!isEditable) return;

    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        setIsDraggingWithRef(false);
        
        if (hasMovedRef.current && onUpdateRef.current) {
          const updates = { 
            posX: zoomRef.current.x, 
            posY: zoomRef.current.y 
          };
          onUpdateRef.current(updates);
          onUpdateCompleteRef.current?.(updates);
        }
      }
    };

    const handleGlobalMouseLeave = (e: MouseEvent) => {
      if (!e.relatedTarget && isDraggingRef.current) {
        setIsDraggingWithRef(false);
        
        if (hasMovedRef.current && onUpdateRef.current) {
          const updates = { 
            posX: zoomRef.current.x, 
            posY: zoomRef.current.y 
          };
          onUpdateRef.current(updates);
          onUpdateCompleteRef.current?.(updates);
        }
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
    };
  }, [isEditable]);

  // 滚轮缩放处理（带防抖）
  useEffect(() => {
    // 直接在内部读取 ref 的最新值
    const element = containerRef.current;
    if (!isEditable || mode !== 'edit' || !element) return;

    const handleWheel = (e: WheelEvent) => {
      if (category !== '封面' && category !== '封底') return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      let newScale = zoomRef.current.scale * delta;
      newScale = Math.min(Math.max(minScale, newScale), maxScale);
      
      setZoomWithRef(prev => ({ ...prev, scale: newScale }));
      
      // 防抖触发 onUpdate
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        if (onUpdateRef.current) {
          const updates = { scale: newScale };
          onUpdateRef.current(updates);
          onUpdateCompleteRef.current?.(updates);
        }
      }, debounceDelay);
    };

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      element.removeEventListener('wheel', handleWheel);
    };
  }, [isEditable, mode, category, minScale, maxScale, debounceDelay]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
 
  useEffect(() => {
    if (hasUserInteractedRef.current) return;
    setZoomWithRef(() => ({
      scale: initialScale,
      x: initialX,
      y: initialY,
    }));
  }, [initialScale, initialX, initialY, setZoomWithRef]);

  const setZoom = useCallback((newZoom: { scale?: number; x?: number; y?: number }) => {
    setZoomWithRef(prev => {
      const updated = {
        scale: newZoom.scale !== undefined ? 
          Math.min(Math.max(minScale, newZoom.scale), maxScale) : prev.scale,
        x: newZoom.x !== undefined ? newZoom.x : prev.x,
        y: newZoom.y !== undefined ? newZoom.y : prev.y,
      };
      return updated;
    });
  }, [minScale, maxScale]);

  const resetZoom = useCallback(() => {
    hasUserInteractedRef.current = false;
    setZoomWithRef(() => ({
      scale: initialScale,
      x: initialX,
      y: initialY,
    }));
  }, [initialScale, initialX, initialY]);

  return {
    zoom,
    isDragging,
    eventHandlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
    },
    containerRef,
    setZoom,
    resetZoom,
  };
}