import { useEffect } from 'react';
import { db } from '../services/db';
import { CONSTANTS } from '../src/constants';
import { decodeB64Utf8 } from '../src/utils/encoding';

interface UseAppInitializationOptions {
  setLogo: (logo: string) => void;
  setSidebarMeta: (meta: string) => void;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  setArticlesAction: (articles: any[]) => void;
  setCurrentId: (id: number | null) => void;
  setIsEditMode: (v: boolean) => void;
  setIsSidebarHidden: (v: boolean) => void;
  setUseAlternateDesign: (v: boolean) => void;
  loading: boolean;
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
  loading,
}: UseAppInitializationOptions) {
  useEffect(() => {
    const init = async () => {
      try {
        // @ts-ignore
        if (window.__SWS_DATA_ARTICLES_B64__) {
          try {
            // @ts-ignore
            const b64Data = window.__SWS_DATA_ARTICLES_B64__;
            const decoded = decodeB64Utf8(b64Data);
            const jsonData = JSON.parse(decoded);

            if (Array.isArray(jsonData)) {
              console.log("📚 Reader Mode: Data loaded from embedded source");
              setArticlesAction(jsonData);
              setIsEditMode(false);
              setIsSidebarHidden(true);

              // @ts-ignore
              if (window.__SWS_DATA_CONFIG_B64__) {
                // @ts-ignore
                const b64Config = window.__SWS_DATA_CONFIG_B64__;
                const cfg = JSON.parse(decodeB64Utf8(b64Config));
                if (cfg.logo) setLogo(cfg.logo);
                if (cfg.sidebarMeta) setSidebarMeta(cfg.sidebarMeta);
                if (cfg.alternateDesign) setUseAlternateDesign(cfg.alternateDesign);
              }

              if (jsonData.length > 0) setCurrentId(jsonData[0].id);
              return;
            }
          } catch (e) {
            console.error("Reader Mode Init Error", e);
          }
        }

        if (db.getConnectionState() !== 'connected') await db.init();
        const storedData = await db.load(CONSTANTS.KEY);
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
