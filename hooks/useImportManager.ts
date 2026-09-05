import { useCallback } from 'react';
import type { Article } from '../src/types';
import { parseEmbeddedData } from '../src/utils/embeddedData';
import { toast } from '../src/utils/toast';

interface UseImportManagerOptions {
  setArticlesAction: (articles: Article[]) => void;
  setLogo: (logo: string) => void;
  setSidebarMeta: (meta: string) => void;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useImportManager({
  setArticlesAction,
  setLogo,
  setSidebarMeta,
  setCategories,
}: UseImportManagerOptions) {
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      try {
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            setArticlesAction(json);
            return;
          }
        } catch (e) { /* 不是纯 JSON，继续 */ }

        const b64ArticlesMatch = text.match(/window\.__SWS_DATA_ARTICLES_B64__\s*=\s*"([\s\S]*?)";/);
        if (b64ArticlesMatch && b64ArticlesMatch[1]) {
          try {
            const methodMatch = text.match(/window\.__SWS_COMPRESSION_METHOD__\s*=\s*"([^"]*)"/);
            const method = methodMatch ? methodMatch[1] : 'none';
            const decodedArticles = await parseEmbeddedData(b64ArticlesMatch[1], method);
            if (Array.isArray(decodedArticles)) setArticlesAction(decodedArticles);

            const configMatch = text.match(/window\.__SWS_DATA_CONFIG_B64__\s*=\s*"([\s\S]*?)";/);
            if (configMatch && configMatch[1]) {
              const cfg = await parseEmbeddedData<{ logo?: string; sidebarMeta?: string }>(configMatch[1], method);
              if (cfg) {
                if (cfg.logo) setLogo(cfg.logo);
                if (cfg.sidebarMeta) setSidebarMeta(cfg.sidebarMeta);
              }
            }
            return;
          } catch (e) { console.error("Base64 Decode Error:", e); }
        }

        const extractFromComment = (marker: string) => {
          const regex = new RegExp(`<!--\\s*${marker}\\s*([\\s\\S]*?)\\s*${marker.split(' ')[0]} END\\s*-->`);
          const match = text.match(regex);
          return match ? match[1].trim() : null;
        };

        const rawData = extractFromComment('DATA START');
        const rawLogo = extractFromComment('LOGO START');
        const rawCats = extractFromComment('CAT START');
        const rawMeta = extractFromComment('META START');

        if (rawData) setArticlesAction(JSON.parse(rawData));
        if (rawLogo) setLogo(rawLogo);
        if (rawCats) setCategories(JSON.parse(rawCats));
        if (rawMeta) setSidebarMeta(rawMeta);

      } catch (err) {
        console.error("Import Parse Error:", err);
        toast.error("导入失败：文件格式不正确或已损坏");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setArticlesAction, setLogo, setSidebarMeta, setCategories]);

  return { handleImport };
}
