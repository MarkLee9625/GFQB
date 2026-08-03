import { useEffect } from 'react';
import type { Article } from '../src/types';
import { db } from '../services/db';
import { CONSTANTS } from '../src/constants';
import { parseEmbeddedData } from '../src/utils/embeddedData';

interface UseAppInitializationOptions {
  setLogo: (logo: string) => void;
  setSidebarMeta: (meta: string) => void;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  setArticlesAction: (articles: Article[]) => Promise<void>;
  setCurrentId: (id: number | null) => void;
  setIsEditMode: (v: boolean) => void;
  setIsSidebarHidden: (v: boolean) => void;
  setUseAlternateDesign: (v: boolean) => void;
}

export function useAppInitialization({
  setLogo,
  setSidebarMeta,
  setCategories,
  setArticlesAction,
  setCurrentId,
  setIsEditMode,
  setIsSidebarHidden,
  setUseAlternateDesign,
}: UseAppInitializationOptions) {
  useEffect(() => {
    const init = async () => {
      try {
        // @ts-ignore
        if (window.__SWS_DATA_ARTICLES_B64__) {
          try {
            // 阅读版：文章数据由 useJournal 统一解析（Worker 解压 + JSON.parse），
            // 这里只处理 UI 状态与配置：不再重复解析文章，也不再全量写入 IndexedDB。
            setIsEditMode(false);
            setIsSidebarHidden(true);

            // @ts-ignore
            if (window.__SWS_DATA_CONFIG_B64__) {
              const method = (window as any).__SWS_COMPRESSION_METHOD__;
              // @ts-ignore
              const cfg = await parseEmbeddedData<{ logo?: string; sidebarMeta?: string; alternateDesign?: boolean }>(
                (window as any).__SWS_DATA_CONFIG_B64__,
                method
              );
              if (cfg) {
                if (cfg.logo) setLogo(cfg.logo);
                if (cfg.sidebarMeta) setSidebarMeta(cfg.sidebarMeta);
                if (cfg.alternateDesign) setUseAlternateDesign(cfg.alternateDesign);
              }
            }
          } catch (e) {
            console.error("Reader Mode Init Error", e);
          }
          return;
        }

        if (db.getConnectionState() !== 'connected') await db.init();
        const storedData = await db.load<Record<string, any>>(CONSTANTS.KEY);
        if (storedData) {
          setLogo(storedData.logo || '');
          setSidebarMeta(storedData.sidebarMetaText || '[部门/内容]');
        }

        const localCats = localStorage.getItem('SWS_CATS_REACT');
        if (localCats) {
          try {
            setCategories(JSON.parse(localCats));
          } catch {
            console.warn('SWS_CATS_REACT 数据损坏，使用默认值');
          }
        }

      } catch (e) {
        console.error("DB Error", e);
      }
    };
    init();
  }, []);
}
