import React, { useState, useRef } from 'react';
import { batchEvaluateArticles, AiEvaluationResult } from '../../services/aiService';

// 更新数据结构：适应本地单文件模式
export interface WechatArticleMeta {
  id: string;
  title: string;
  fileName: string;
  content: string; // 完整 Markdown 正文
  digest?: string;  // 截取的摘要，供 UI 展示（改为可选，兼容旧数据）
  aiSummary?: string; // AI 提炼的真实技术摘要
  url?: string;    // 手动追加的外部链接保留此字段
  decision?: 'recommend' | 'reject' | 'pending';
  reason?: string;
  tags?: string[];
}

interface AiCurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdopt: (article: WechatArticleMeta) => void;
}

export default function AiCurationModal({ isOpen, onClose, onAdopt }: AiCurationModalProps) {
  const [articles, setArticles] = useState<WechatArticleMeta[]>([]);
  const [manualUrl, setManualUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // 【新增】记录 AI 阅卷进度文本
  const [progressText, setProgressText] = useState('');
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 核心功能：支持 Shift 批量上传并并发解析每一个 MD 文件
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setIsProcessing(true);

    const readPromises = files.map((file: File) => {
      return new Promise<WechatArticleMeta>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string || '';
          
          // 1. 提取标题：匹配第一个 "# 标题"，如果没匹配到，则使用去掉 .md 后缀的文件名
          const titleMatch = text.match(/^#\s+(.*)/m);
          const title = titleMatch ? titleMatch[1].trim() : file.name.replace(/\.[^/.]+$/, "");

          // 2. 提取摘要：移除常见的 markdown 符号，截取前 120 个字符
          const cleanText = text.replace(/[#*_\[\]!>]/g, '').replace(/\n+/g, ' ').trim();
          const digest = cleanText.substring(0, 120) + '...';

          resolve({
            id: Math.random().toString(36).substr(2, 9),
            title,
            fileName: file.name,
            content: text,
            digest,
            decision: 'pending', // 初始进入测试挂起状态
          });
        };
        reader.readAsText(file);
      });
    });

    // 等待所有文件解析完毕，拼接到现有列表中
  const parsedArticles = await Promise.all(readPromises);
    setArticles((prev: WechatArticleMeta[]) => [...prev, ...parsedArticles]);
    setIsProcessing(false);
    
    // 清空 input，允许重复上传同一批文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleStartAiEvaluation = async () => {
    const pendingArticles = articles.filter(a => a.decision === 'pending');
    const totalCount = pendingArticles.length;
    if (totalCount === 0) return;

    setIsProcessing(true);
    setProgressText(`准备发送 ${totalCount} 篇文章...`);
    let processedCount = 0;

    try {
      const evaluationInput = pendingArticles.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content 
      }));

      const BATCH_SIZE = 5; 
      const chunks: { id: string; title: string; content: string }[][] = [];
      for (let i = 0; i < evaluationInput.length; i += BATCH_SIZE) {
        chunks.push(evaluationInput.slice(i, i + BATCH_SIZE));
      }

      // 【核心改造：边批改，边渲染】
      for (let i = 0; i < chunks.length; i++) {
        setProgressText(`正在阅卷 (${processedCount} / ${totalCount}) 篇...`);
        
        // 1. 等待这一小批（5篇）的 AI 结果
        const chunkResults = await batchEvaluateArticles(chunks[i]);
        
        // 2. 拿到结果后，立刻更新 UI 状态！（增量渲染）
        setArticles(prevArticles => prevArticles.map(article => {
          const aiResult = chunkResults.find(r => r.id === article.id);
          if (aiResult) {
            return { 
              ...article, 
              aiSummary: aiResult.aiSummary, 
              decision: aiResult.decision, 
              reason: aiResult.reason, 
              tags: aiResult.tags 
            };
          }
          return article;
        }));

        processedCount += chunks[i].length;
        setProgressText(`正在阅卷 (${processedCount} / ${totalCount}) 篇...`);

        // 3. 喘口气，防 429 频控
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setProgressText('✅ 阅卷全部完成！');
      setTimeout(() => setProgressText(''), 3000); // 3秒后清除提示

    } catch (error) {
      console.error(error);
      alert("AI 评审遇到网络波动，已完成部分阅卷，剩下的请稍后再试！");
      setProgressText('');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-[90vw] max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* 顶部 Header 控制区 */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🤖</span> AI 智能选题总编室
            </h2>
            
            {/* 核心改造：添加 multiple 属性支持批量上传 */}
            <div className="flex items-center gap-2 ml-4">
              <input 
                type="file" 
                accept=".md" 
                multiple
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                id="md-upload" 
              />
              <label 
                htmlFor="md-upload" 
                className={`cursor-pointer px-4 py-2 border rounded-lg text-sm font-semibold shadow-sm transition-all ${isProcessing ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {isProcessing ? '⏳ 正在极速解析...' : '📁 批量导入文章 (.md)'}
              </label>
              <span className="text-xs text-gray-500 font-medium">已入库: {articles.length} 篇</span>
              {articles.some((a: WechatArticleMeta) => a.decision === 'pending') && (
                <button 
                  onClick={handleStartAiEvaluation}
                  disabled={isProcessing}
                  className="ml-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-80 disabled:cursor-wait"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="4" strokeOpacity="0.3"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      🧠 {progressText}
                    </span>
                  ) : '🤖 开始 AI 智能评审'}
                </button>
              )}
            </div>
          </div>

          {/* 👑 总编特权：手动追加 */}
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="🔗 粘贴外部文章链接..." 
              className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
            />
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-colors">
              ➕ 强制采纳
            </button>
            <button onClick={onClose} className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* 主体双栏沙盘区 */}
        <div className="flex-1 flex overflow-hidden bg-gray-50">
          
          {/* 左侧：淘汰区 */}
          <div className="w-1/3 border-r border-gray-200 bg-gray-100 flex flex-col">
            <div className="p-3 bg-gray-200 text-gray-600 font-bold text-sm border-b border-gray-300 flex justify-between items-center">
              <span>🗑️ AI 淘汰区 (非硬核技术)</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {articles.filter((a: WechatArticleMeta) => a.decision === 'reject').length === 0 ? (
                <div className="text-center text-gray-400 text-sm mt-10">暂无淘汰文章</div>
              ) : (
                articles.filter((a: WechatArticleMeta) => a.decision === 'reject').map((article: WechatArticleMeta) => (
                  <div key={article.id} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm group opacity-70 hover:opacity-100 transition-opacity">
                    <h4 className="font-bold text-gray-700 text-sm mb-1">{article.title}</h4>
                    <p className="text-xs text-red-500 font-medium mb-2 flex items-start gap-1">
                      <span>🛑</span> {article.reason}
                    </p>
                    <button 
                      onClick={() => setArticles(prev => prev.map(a => a.id === article.id ? { ...a, decision: 'recommend' } : a))}
                      className="w-full py-1.5 bg-gray-100 text-gray-600 rounded text-xs font-bold hover:bg-blue-100 hover:text-blue-700 transition-colors"
                    >
                      ↩️ 强行捞回推荐区
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 右侧：推荐区 */}
          <div className="flex-1 flex flex-col bg-white">
            <div className="p-3 bg-blue-50 text-blue-800 font-bold text-sm border-b border-blue-100 flex justify-between items-center">
              <span>⭐️ AI 强烈推荐 (先进工法/智能制造)</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {/* 测试阶段：展示解析出的文章数据 */}
              {articles.filter(a => a.decision === 'pending' || a.decision === 'recommend').map((article) => (
                <div key={article.id} className="p-4 border border-blue-100 bg-white rounded-xl shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${article.decision === 'recommend' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {article.decision === 'recommend' ? '⭐️ AI推荐' : '等待 AI 评审'}
                        </span>
                        <span className="text-xs text-gray-400 truncate border-l pl-2 border-gray-200" title={article.fileName}>{article.fileName}</span>
                      </div>
                      <h4 className="font-bold text-gray-800 text-base leading-snug truncate" title={article.title}>{article.title}</h4>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                        {article.aiSummary || "等待 AI 通读全文并生成核心摘要..."}
                      </p>
                      
                      {/* AI 评审结果展示 */}
                      {article.decision === 'recommend' && (
                        <div className="mt-2 mb-1 flex items-center gap-2 flex-wrap">
                          {article.tags?.map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{tag}</span>
                          ))}
                          <span className="text-xs text-green-600 font-semibold ml-1 flex items-center gap-1">
                            <span>✨</span> {article.reason}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* 核心修复：柔性采纳按钮 */}
                    {(() => {
                      const isAdopted = adoptedIds.has(article.id);
                      return (
                        <button 
                          onClick={() => {
                            if (onAdopt) onAdopt(article);
                            // 记录为已采纳，但不禁用按钮
                            setAdoptedIds(prev => new Set(prev).add(article.id));
                          }}
                          className={`flex-shrink-0 px-4 py-2 border rounded-lg text-sm font-bold transition-all
                            ${isAdopted 
                              ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-600 hover:text-white opacity-100' 
                              : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white opacity-0 group-hover:opacity-100'
                            }`}
                        >
                          {isAdopted ? '🔁 再次采纳' : '➕ 采纳正文'}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {articles.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-20 flex flex-col items-center">
                  <span className="text-4xl mb-4 opacity-50">📑</span>
                  点击左上角按钮，可按住 Shift 批量选中多个 .md 文件上传
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}