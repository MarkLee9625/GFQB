import { useCallback } from 'react';
import type { Article, UniversalArticleMeta } from '../src/types';
import { generateForeword, extractGlobalKnowledgeGraph, buildSuperContextForGraph, validateGraphQuality, KnowledgeGraphData } from '../services/aiService';
import { generateGraphHtml } from '../src/utils/graphRenderer';
import { parseMarkdownToHtml } from '../src/utils/fileHelpers';
import { getGraphCache, saveGraphCache, contentHash } from '../services/graphCache';

interface UseAiFeaturesOptions {
  articles: Article[];
  createArticle: (article: Partial<Article>) => Promise<Article | undefined>;
  setCurrentId: (id: number | null) => void;
  setImportProgress: (progress: { stage: string; details: string } | null) => void;
  importProgress: { stage: string; details: string } | null;
}

export function useAiFeatures({
  articles,
  createArticle,
  setCurrentId,
  setImportProgress,
  importProgress,
}: UseAiFeaturesOptions) {
  const handleGenerateForeword = useCallback(async () => {
    if (importProgress) return;
    const validArticles = articles.filter(a =>
      a.category !== '封面' &&
      a.category !== '封底' &&
      a.title &&
      a.title !== '未命名文章'
    );

    if (validArticles.length === 0) {
      alert("当前没有任何有效文章，无法生成导读！请先添加文章内容。");
      return;
    }

    setImportProgress({ stage: 'generating', details: 'DeepSeek 正在纵览全文，撰写本期卷首语，请稍候 (约 30-60 秒)...' });

    try {
      const htmlContent = await generateForeword(validArticles);

      const newArt = await createArticle({
        title: '本期导读 / 卷首语',
        category: '特别报道',
        content: htmlContent,
        abstract: '本文由 AI 根据本期收录的工法情报(含正文)自动统稿生成，旨在为您提供宏观的技术导览。',
        isPublished: true
      });

      if (newArt) {
        setCurrentId(newArt.id);
        setTimeout(() => alert('✨ 卷首语生成成功！AI 已自动为您排版。'), 100);
      }
    } catch (err) {
      alert('生成卷首语失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setImportProgress(null);
    }
  }, [articles, createArticle, setCurrentId, setImportProgress, importProgress]);

  const handleGenerateGraph = useCallback(async () => {
    if (importProgress) return;
    const validArticles = articles.filter(a =>
      a.category !== '封面' &&
      a.category !== '封底' &&
      (a.content || a.pdfData)
    );

    if (validArticles.length === 0) {
      return alert("当前无有效内容或 PDF 附件，无法提取图谱！");
    }

    setImportProgress({ stage: 'generating', details: '正在深度解析 PDF 与全刊内容，构建超级上下文...' });

    try {
      const allText = await buildSuperContextForGraph(validArticles);
      const finalContext = allText.slice(0, 120000);

      // 计算内容 hash，用于缓存键
      const articleIds = validArticles.map(a => a.id).join(',');
      const contentHashValue = await contentHash(articleIds + ':' + finalContext);

      // 【缓存检查】按内容 hash 查找，避免重复调用 AI
      const cached = await getGraphCache(contentHashValue);
      
      let graphData: KnowledgeGraphData;
      let fromCache = false;

      if (cached && typeof cached === 'object' && 'nodes' in cached && 'links' in cached) {
        graphData = cached as KnowledgeGraphData;
        fromCache = true;
        console.log('[App] 使用缓存的知识图谱，跳过 AI 调用');
        setImportProgress({ stage: 'generating', details: '✅ 检测到缓存，正在加载历史图谱...' });
      } else {
        graphData = await extractGlobalKnowledgeGraph(finalContext, (stage, detail) => {
          setImportProgress({ stage: 'generating', details: `[${stage}] ${detail}` });
        });
        // 保存新结果到缓存
        await saveGraphCache(contentHashValue, graphData, validArticles.length);
      }

      const qualityReport = validateGraphQuality(graphData);
      console.log('[App] 图谱质量报告:', qualityReport);

      const htmlContent = generateGraphHtml(graphData);

      const newArt = await createArticle({
        title: '本期技术知识图谱',
        category: '特别报道',
        content: htmlContent,
        abstract: '本图谱由 AI 引擎根据全刊内容(含深度解析的PDF文献)自动提炼，展示了本期收录的核心工艺、材料与设备之间的技术拓扑关系。',
        isPublished: true
      });

      if (newArt) {
        setCurrentId(newArt.id);
        const qualityMsg = qualityReport.isValid
          ? `✅ 质量校验通过！节点 ${qualityReport.nodeCount} 个，关系 ${qualityReport.linkCount} 条，连通率 ${(qualityReport.connectivityRatio * 100).toFixed(0)}%`
          : `⚠️ 质量提示：\n${qualityReport.warnings.join('\n')}`;
        const cacheNote = fromCache ? '\n\n💾 使用历史缓存数据（0 秒加载）' : '';
        setTimeout(() => alert(`🕸️ 知识图谱生成成功！${fromCache ? '' : ''}\n\n${qualityMsg}${cacheNote}`), 100);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      let friendlyMessage = '生成图谱失败，请稍后重试。如问题持续存在请联系管理员。';
      if (errorMessage.includes('内容为空') || errorMessage.includes('finish_reason')) {
        friendlyMessage = 'AI 未能从文章内容中提取出足够的知识节点，请确保文章包含丰富的技术内容后重试。';
      } else if (errorMessage.includes('超时') || errorMessage.includes('AbortError')) {
        friendlyMessage = 'AI 处理时间较长，可能是文章内容过多，请稍后重试或减少文章数量。';
      } else if (errorMessage.includes('429')) {
        friendlyMessage = 'AI 服务请求过于频繁，请稍等片刻后重试。';
      } else if (errorMessage.includes('JSON')) {
        friendlyMessage = 'AI 返回的数据格式异常，请重试或检查文章内容是否包含足够技术信息。';
      }
      alert(friendlyMessage);
    } finally {
      setImportProgress(null);
    }
  }, [articles, createArticle, setCurrentId, setImportProgress, importProgress]);

  const handleForceGenerateGraph = useCallback(async () => {
    if (importProgress) return;

    const confirmed = window.confirm(
      '⚠️ 重新生成将调用 AI 重新提取知识图谱（约消耗 2-3 次 API 调用，可能需要 3-5 分钟）。\n\n' +
      '如果文章内容未变化，建议使用"提取全局知识图谱"直接加载缓存。\n\n确定继续？'
    );
    if (!confirmed) return;

    const validArticles = articles.filter(a =>
      a.category !== '封面' &&
      a.category !== '封底' &&
      (a.content || a.pdfData)
    );

    if (validArticles.length === 0) {
      return alert("当前无有效内容或 PDF 附件，无法提取图谱！");
    }

    // 重新生成成功后由 handleGenerateGraph 自动更新缓存，无需提前删除
    await handleGenerateGraph();
  }, [articles, handleGenerateGraph, importProgress]);

  const handleAdoptArticle = useCallback(async (article: UniversalArticleMeta) => {
    try {
      const htmlContent = parseMarkdownToHtml(article.content);

      const newArt = await createArticle({
        title: article.title || '未命名文章',
        category: 'AI选题',
        content: htmlContent,
        abstract: article.aiSummary || '',
        isPublished: true,
        tags: article.tags || []
      });

      if (newArt) {
        setCurrentId(newArt.id);
        setTimeout(() => alert(`✅ 文章 "${article.title}" 已成功采纳！`), 100);
      }
    } catch (err) {
      alert('采纳文章失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  }, [createArticle, setCurrentId]);

  return {
    handleGenerateForeword,
    handleGenerateGraph,
    handleForceGenerateGraph,
    handleAdoptArticle,
  };
}
