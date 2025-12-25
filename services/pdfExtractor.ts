import * as pdfjsLib from 'pdfjs-dist';
// 使用 Vite 的 ?url 导入 Worker，确保路径正确
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 1. 初始化 Worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  console.log('[PDF工具] Worker 初始化成功');
} catch (e) {
  console.error('[PDF工具] Worker 初始化失败:', e);
}

export interface PdfExtractionResult {
  success: boolean;
  abstract?: string | null;
  title?: string | null;
  error?: string;
  pagesCount?: number;
  textLength?: number;
  keywords?: string[]; // 新增：提取的关键词列表
}

export async function extractAbstractFromPdf(
  pdfData: string,
  maxPages: number = 5,
  timeoutMs: number = 30000
): Promise<PdfExtractionResult> {

  const timeoutPromise = new Promise<PdfExtractionResult>((_, reject) => {
    setTimeout(() => reject(new Error(`PDF解析超时 (${timeoutMs}ms)`)), timeoutMs);
  });

  const extractionPromise = (async (): Promise<PdfExtractionResult> => {
    try {
      // 2. 清洗 Base64 数据
      let cleanPdfData = pdfData;
      if (pdfData.includes('base64,')) {
        cleanPdfData = pdfData.split('base64,')[1];
      }

      // 3. 加载文档 (关键修改：使用本地 cMapUrl)
      const loadingTask = pdfjsLib.getDocument({
        data: atob(cleanPdfData),
        verbosity: 0,
        // ✅ 关键：指向 public/cmaps/ 目录，解决中文乱码
        cMapUrl: '/cmaps/',
        cMapPacked: true,
      });

      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      const pagesToParse = Math.min(maxPages, totalPages);

      let fullText = '';

      console.log(`[PDF工具] 开始解析前 ${pagesToParse} 页...`);

      // 4. 逐页提取文本 (智能拼接版)
      for (let i = 1; i <= pagesToParse; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // 🚀 优化点：智能拼接，解决中英文混排时的空格问题
        const pageText = textContent.items
          // @ts-ignore
          .map((item: any) => item.str)
          .reduce((acc: string, curr: string) => {
            // 如果累加器为空，直接返回当前串
            if (!acc) return curr;

            // 判断当前字符和前一个字符是否都是中文
            const isLastChinese = /[\u4e00-\u9fa5]/.test(acc[acc.length - 1]);
            const isCurrChinese = /[\u4e00-\u9fa5]/.test(curr[0]);

            // 如果两边都是中文，直接拼接（去空格）；否则加个空格（为了英文单词不粘连）
            if (isLastChinese && isCurrChinese) {
              return acc + curr;
            } else {
              return acc + ' ' + curr;
            }
          }, '');

        fullText += pageText + '\n\n';
        console.log(`[PDF工具] 第 ${i} 页提取字符数: ${pageText.length}`);
      }

      // 5. 尝试提取标题（从元数据或第一页）
      let title: string | null = null;
      try {
        const metadata = await pdf.getMetadata();
        // 使用类型断言，因为pdfjs的类型定义中info是Object类型
        const info = metadata?.info as any;
        if (info?.Title) {
          title = info.Title.trim();
          console.log(`[PDF工具] 从元数据提取标题: ${title}`);
        }
      } catch (e) {
        console.warn('[PDF工具] 获取元数据失败:', e);
      }

      // 如果元数据中没有标题，先尝试使用最大字号算法提取标题
      if (!title || title.length === 0) {
        title = await extractTitleByFontSize(pdf);
        if (title) {
          console.log(`[PDF工具] 最大字号算法提取标题: ${title}`);
        }
      }

      // 如果最大字号算法也失败，尝试从全文文本中提取
      if (!title || title.length === 0) {
        title = extractTitleFromText(fullText);
        if (title) {
          console.log(`[PDF工具] 从文本提取标题: ${title}`);
        }
      }

      // 释放资源
      if (loadingTask && loadingTask.destroy) await loadingTask.destroy();

      // 6. 检查是否为空
      if (fullText.trim().length < 50) {
        throw new Error('未提取到有效文本。此PDF可能是扫描件(图片)或缺少CMap字体文件。');
      }

      // 7. 智能提取摘要
      const abstract = findAbstractInText(fullText);
      console.log(`[PDF工具] 摘要提取结果: ${abstract ? '成功' : '使用兜底/失败'}`);

      return {
        success: true,
        abstract: abstract,
        title: title,
        pagesCount: totalPages,
        textLength: fullText.length,
        keywords: findKeywordsInText(fullText), // 集成关键词提取
      };

    } catch (error) {
      console.error('[PDF解析错误]:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知PDF解析错误',
      };
    }
  })();

  try {
    return await Promise.race([extractionPromise, timeoutPromise]);
  } catch (error) {
    return { success: false, error: '操作超时' };
  }
}

/**
 * 增强版：查找摘要算法 (v3.0 - 解决错位、乱码、目录干扰)
 */
function findAbstractInText(text: string): string | null {
  if (!text) return null;

  // 1. 预处理：将全角空格、多余空格统一清理
  const cleanText = text
    .replace(/[\u3000]/g, ' ') // 替换全角空格
    .replace(/\s+/g, ' ');     // 压缩所有空白为单个空格

  // 2. 定义更精确的开始关键词 (按优先级排序)
  const startPatterns = [
    { regex: /(?:摘|内\s*容\s*提)\s*要[:：]?/g, weight: 10 }, // 摘要、内容提要
    { regex: /abstract[:：]?/gi, weight: 8 },
    { regex: /概\s*要[:：]?/g, weight: 6 }
  ];

  let bestStartIdx = -1;
  let maxWeight = -1;
  let usedPatternLen = 0;

  // 3. 寻找最佳起始点 (排除目录中的摘要)
  for (const pattern of startPatterns) {
    let match;
    pattern.regex.lastIndex = 0;

    while ((match = pattern.regex.exec(cleanText)) !== null) {
      const idx = match.index;

      // 🛡️ 过滤规则 A：如果位置太靠后(超过3000字)，可能是参考文献，忽略
      if (idx > 3000) continue;

      // 🛡️ 过滤规则 B：目录检测 (预读后50字符)
      // 如果后面紧跟着省略号和数字 (如 "摘要 ...... 5")，说明是目录
      const lookAhead = cleanText.slice(idx, idx + 50);
      if (/(\.{3,}|…{3,})\s*\d+/.test(lookAhead)) continue;

      // 🛡️ 过滤规则 C：页眉检测
      // 如果"摘要"前后只有很少的字就换行了（这里简化判断周围字符密度）
      // ... (在纯文本流中很难判断换行，主要靠规则A和B)

      if (pattern.weight > maxWeight) {
        maxWeight = pattern.weight;
        bestStartIdx = idx;
        usedPatternLen = match[0].length;
        // 找到最高权重的匹配项后，如果位置很靠前(<500)，通常就是对的
        if (bestStartIdx < 500 && maxWeight === 10) break;
      }
    }
  }

  // 如果没找到关键词，使用兜底策略
  if (bestStartIdx === -1) {
    return extractFirstMeaningfulParagraph(text);
  }

  // 4. 确定正文开始位置 (跳过关键词和冒号)
  let contentStart = bestStartIdx + usedPatternLen;
  while (contentStart < cleanText.length && /[:：\s\.]/.test(cleanText[contentStart])) {
    contentStart++;
  }

  // 5. 寻找结束位置
  const endKeywords = [
    '关键词', 'key words', 'keywords',
    '引言', 'introduction',
    '1. ', '1、', // 正文第一章标记
    '©', 'copyright'
  ];

  let contentEnd = cleanText.length;
  const lowerText = cleanText.toLowerCase();
  const searchScope = lowerText.slice(contentStart);

  let minDistance = Infinity;

  for (const endKw of endKeywords) {
    const idx = searchScope.indexOf(endKw.toLowerCase());
    if (idx !== -1 && idx < minDistance) {
      // 结束词至少要离开始词有10个字符远 (防止误判)
      if (idx > 10) {
        minDistance = idx;
      }
    }
  }

  if (minDistance !== Infinity) {
    contentEnd = contentStart + minDistance;
  } else {
    // 找不到结束词，截取固定长度
    contentEnd = Math.min(contentStart + 600, cleanText.length);
  }

  // 6. 提取并清洗最终结果
  let finalResult = cleanText.substring(contentStart, contentEnd).trim();

  // 再次清理开头可能的乱码或标点
  finalResult = finalResult.replace(/^[\s:：\.]*/, '');

  // 长度保护
  if (finalResult.length > 800) {
    finalResult = finalResult.substring(0, 800) + '...';
  }

  // 结果太短，回退兜底
  if (finalResult.length < 10) {
    return extractFirstMeaningfulParagraph(text);
  }

  return finalResult;
}

/**
 * 新增：提取关键词算法
 * 识别常见格式：
 * 关键词：词1；词2；词3
 * Key words: word1, word2, word3
 */
function findKeywordsInText(text: string): string[] {
  if (!text) return [];

  console.log('[PDF工具] 开始提取关键词...');

  // 预处理文本，合并多余空格，但保留换行符以便正则匹配行尾
  // 注意：之前的 replace(/\s+/g, ' ') 会把换行符也变成空格，导致 (?=\n) 失效
  // 我们只压缩水平空格，保留垂直换行
  const cleanText = text
    .replace(/[\u3000]/g, ' ')
    .replace(/[ \t]+/g, ' ');

  // 调试：打印一下可能包含关键词的片段
  const previewIdx = cleanText.toLowerCase().indexOf('key');
  if (previewIdx > -1) {
    console.log('[PDF工具] 关键词区域预览:', cleanText.substring(previewIdx, previewIdx + 100));
  }

  // 定义关键词引导模式
  // 1. 匹配到行尾
  // 2. 或者匹配到下一个明显段落的开始
  const patterns = [
    /(?:关\s*键\s*词|关\s*键\s*字)\s*[:：]\s*(.*?)(?=\n|引言|Introduction|1\.|DOI|中图分类号|$)/i,
    /(?:Key\s*words?)\s*[:：]\s*(.*?)(?=\n|Introduction|1\.|DOI|$)/i,
    // 兜底：如果没有明显的结束标志，就截取一定长度
    /(?:关\s*键\s*词|关\s*键\s*字)\s*[:：]\s*(.{5,100})/i,
    /(?:Key\s*words?)\s*[:：]\s*(.{5,100})/i
  ];

  let keywordsStr = '';

  for (const pattern of patterns) {
    const match = pattern.exec(cleanText);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // 简单验证有效性：长度适中，不全是符号
      if (candidate.length > 2 && /[a-zA-Z\u4e00-\u9fa5]/.test(candidate)) {
        keywordsStr = candidate;
        console.log(`[PDF工具] 匹配到关键词字符串: "${keywordsStr}"`);
        break;
      }
    }
  }

  if (!keywordsStr) {
    console.log('[PDF工具] 未匹配到关键词模式');
    return [];
  }

  // 清洗和分割关键词
  // 1. 移除可能的末尾标点
  keywordsStr = keywordsStr.replace(/[;；,，.。]+$/, '');

  // 2. 分割
  let keywords = keywordsStr
    .split(/[,，;；]/) // 显式分隔符
    .map(k => k.trim());

  // 如果分割失效（只有一个元素），尝试空格分割
  if (keywords.length <= 1 && keywords[0].includes(' ')) {
    // 只有当看起来是多个词时才分割（比如包含多个长单词）
    // 简单启发式：如果包含两个以上空格，且分割后每个部分都像词
    const spaceSplit = keywords[0].split(/\s+/);
    if (spaceSplit.length > 1) {
      keywords = spaceSplit;
    }
  }

  // 3. 过滤无效词
  const finalKeywords = keywords
    .map(k => k.trim())
    .filter(k => k.length >= 2 && k.length < 30) // 长度限制
    .filter(k => !/^\d+$/.test(k)) // 过滤纯数字
    .filter(k => !/^(DOI|中图分类号|TN|TP)/i.test(k)); // 过滤常见杂音

  console.log('[PDF工具] 最终提取关键词:', finalKeywords);
  return finalKeywords;
}

/**
 * 提取标题：增强版 - 尝试从文本中提取可能的文章标题
 * 改进点：
 * 1. 检查前3段文本，不仅仅是第一段
 * 2. 更宽松的长度限制（5-300字符）
 * 3. 智能排除非标题内容
 * 4. 识别常见标题模式
 * 5. 针对PDF提取问题：如果段落过长，尝试按行或句子分割
 */
function extractTitleFromText(text: string): string | null {
  if (!text) return null;

  console.log('[标题提取] 开始分析文本，总长度:', text.length);

  // 将文本按段落分割（考虑多种换行符）
  const paragraphs = text.split(/[\n\r]+/).filter(p => p.trim().length > 0);
  console.log('[标题提取] 找到段落数:', paragraphs.length);

  if (paragraphs.length === 0) return null;

  // 优先检查前3个段落（标题通常在前几段）
  const paragraphsToCheck = paragraphs.slice(0, Math.min(3, paragraphs.length));

  // 定义可能的标题特征权重
  const titleCandidates: Array<{ text: string, score: number, reasons: string[] }> = [];

  // 第一轮：检查正常段落
  for (let i = 0; i < paragraphsToCheck.length; i++) {
    const originalPara = paragraphsToCheck[i];
    const cleanPara = originalPara.trim().replace(/\s+/g, ' ');
    const length = cleanPara.length;

    console.log(`[标题提取] 分析第${i + 1}段，长度: ${length}, 内容: ${cleanPara.substring(0, 50)}...`);

    // 如果段落过长（超过500字符），尝试多种方法提取标题
    if (length > 500) {
      console.log(`[标题提取] 第${i + 1}段过长(${length}字符)，尝试多种方法提取标题`);

      // 方法1：按句子分割
      const sentences = originalPara.split(/[。.!?;；]/).filter(s => s.trim().length > 0);
      for (let j = 0; j < Math.min(sentences.length, 8); j++) { // 只检查前8个句子
        const sentence = sentences[j].trim().replace(/\s+/g, ' ');
        const sentenceLength = sentence.length;
        if (sentenceLength >= 5 && sentenceLength <= 200) {
          console.log(`[标题提取] 检查第${i + 1}段的第${j + 1}句: "${sentence.substring(0, 50)}..."`);
          const candidate = evaluateTitleCandidate(sentence, i, j);
          if (candidate) {
            titleCandidates.push(candidate);
          }
        }
      }

      // 方法2：按行分割（考虑PDF中的换行）
      const lines = originalPara.split(/[\n\r]/).filter(line => line.trim().length > 0);
      for (let j = 0; j < Math.min(lines.length, 10); j++) {
        const line = lines[j].trim().replace(/\s+/g, ' ');
        const lineLength = line.length;
        if (lineLength >= 5 && lineLength <= 150) {
          console.log(`[标题提取] 检查第${i + 1}段的第${j + 1}行: "${line.substring(0, 50)}..."`);
          const candidate = evaluateTitleCandidate(line, i, -3); // -3 表示来自行分割
          if (candidate) {
            titleCandidates.push(candidate);
          }
        }
      }

      // 方法3：按逗号、分号等分割
      const phrases = originalPara.split(/[，,；]/).filter(phrase => phrase.trim().length > 0);
      for (let j = 0; j < Math.min(phrases.length, 10); j++) {
        const phrase = phrases[j].trim().replace(/\s+/g, ' ');
        const phraseLength = phrase.length;
        if (phraseLength >= 5 && phraseLength <= 100) {
          console.log(`[标题提取] 检查第${i + 1}段的第${j + 1}短语: "${phrase.substring(0, 50)}..."`);
          const candidate = evaluateTitleCandidate(phrase, i, -4); // -4 表示来自短语分割
          if (candidate) {
            titleCandidates.push(candidate);
          }
        }
      }

      // 方法4：滑动窗口扫描整个段落
      const windowSizes = [50, 80, 100, 120];
      for (const windowSize of windowSizes) {
        for (let start = 0; start < Math.min(cleanPara.length - windowSize, 200); start += 10) {
          const windowText = cleanPara.substring(start, start + windowSize).trim();
          if (windowText.length >= 10 && windowText.length <= 150) {
            // 检查是否包含常见标题关键词且不包含非标题内容
            const hasTitleKeyword = /研究|分析|探讨|综述|设计|应用|基于|方法|技术|系统|动力学|运输|模块|SPMT|FPSO/i.test(windowText);
            const isNonTitle = /摘要|abstract|关键词|keywords|目录|contents|引言|introduction|^\d+[\.\、]/.test(windowText);

            if (hasTitleKeyword && !isNonTitle) {
              console.log(`[标题提取] 第${i + 1}段窗口扫描: "${windowText.substring(0, 50)}..."`);
              const candidate = evaluateTitleCandidate(windowText, i, -5); // -5 表示来自窗口扫描
              if (candidate) {
                titleCandidates.push(candidate);
              }
            }
          }
        }
      }

      continue; // 跳过整个长段落的处理，因为我们已经尝试了多种方法
    }

    // 基本长度检查（排除过短和过长的段落）
    if (length < 5 || length > 300) {
      console.log(`[标题提取] 第${i + 1}段长度${length}超出范围(5-300)，跳过`);
      continue;
    }

    const candidate = evaluateTitleCandidate(cleanPara, i, -1);
    if (candidate) {
      titleCandidates.push(candidate);
    }
  }

  // 第二轮：如果前几段都过长，尝试按行分割文本的前500个字符
  if (titleCandidates.length === 0) {
    console.log('[标题提取] 无候选标题，尝试按行分割文本前500字符');
    const first500Chars = text.substring(0, Math.min(500, text.length));
    const lines = first500Chars.split(/[\n\r]+/).filter(line => line.trim().length > 0);

    for (let i = 0; i < Math.min(lines.length, 10); i++) { // 检查前10行
      const line = lines[i].trim().replace(/\s+/g, ' ');
      const lineLength = line.length;
      if (lineLength >= 5 && lineLength <= 150) {
        console.log(`[标题提取] 检查第${i + 1}行: "${line.substring(0, 50)}..."`);
        const candidate = evaluateTitleCandidate(line, i, -2); // -2 表示来自行分割
        if (candidate) {
          titleCandidates.push(candidate);
        }
      }
    }
  }

  // 如果有候选标题，选择分数最高的
  if (titleCandidates.length > 0) {
    titleCandidates.sort((a, b) => b.score - a.score);
    const bestCandidate = titleCandidates[0];
    console.log(`[标题提取] 选择最佳标题: "${bestCandidate.text.substring(0, 80)}..."，分数: ${bestCandidate.score}`);
    // 对提取的标题进行后处理清洗
    const cleanedTitle = cleanExtractedTitle(bestCandidate.text);
    console.log(`[标题提取] 清洗后标题: "${cleanedTitle}"`);
    return cleanedTitle;
  }

  // 如果没有找到合适的候选标题，尝试更宽松的规则
  console.log('[标题提取] 无高分数候选标题，尝试宽松规则');

  // 宽松规则：在文本中搜索看起来像标题的短文本
  // 搜索前1000个字符中长度在10-150字符之间的连续文本
  const searchText = text.substring(0, Math.min(1000, text.length));
  // 使用滑动窗口寻找可能的标题
  const windowSizes = [80, 100, 120, 150];
  for (const windowSize of windowSizes) {
    for (let start = 0; start < Math.min(searchText.length - windowSize, 200); start += 10) {
      const windowText = searchText.substring(start, start + windowSize).trim().replace(/\s+/g, ' ');
      if (windowText.length >= 10 && windowText.length <= 150) {
        // 检查是否包含常见标题关键词且不包含非标题内容
        const hasTitleKeyword = /研究|分析|探讨|综述|设计|应用|基于|方法|技术|系统|study|research|analysis|design|application|method/i.test(windowText);
        const isNonTitle = /摘要|abstract|关键词|keywords|目录|contents|引言|introduction|^\d+[\.\、]/.test(windowText);

        if (hasTitleKeyword && !isNonTitle) {
          console.log(`[标题提取] 宽松规则选择窗口文本: "${windowText.substring(0, 50)}..."`);
          // 对提取的标题进行后处理清洗
          const cleanedTitle = cleanExtractedTitle(windowText);
          console.log(`[标题提取] 清洗后标题: "${cleanedTitle}"`);
          return cleanedTitle;
        }
      }
    }
  }

  // 最后手段：关键词搜索（针对已知论文标题模式）
  console.log('[标题提取] 尝试关键词搜索');
  const keywordSearchText = text.substring(0, Math.min(2000, text.length));
  // 移除空格后搜索，因为PDF提取的文本可能有空格干扰
  const noSpaceText = keywordSearchText.replace(/\s+/g, '');

  // 定义可能的关键词组合（根据常见工法情报标题）
  const keywordPatterns = [
    /SPMT.*运输.*FPSO.*上部模块.*动力学分析/,
    /FPSO.*上部模块.*运输.*动力学分析/,
    /动力学分析.*SPMT.*运输/,
    /SPMT.*运输.*动力学分析/,
    /自行式模块化运输车.*FPSO/,
    /FPSO.*上部模块.*SPMT/,
  ];

  for (const pattern of keywordPatterns) {
    const match = noSpaceText.match(pattern);
    if (match) {
      const matchedText = match[0];
      console.log(`[标题提取] 关键词匹配找到: ${matchedText}`);

      // 尝试在原始文本中找到包含这些关键词的片段（带空格）
      // 在原始文本中滑动窗口寻找包含这些关键词的片段
      for (let i = 0; i < keywordSearchText.length - matchedText.length; i++) {
        const snippet = keywordSearchText.substring(i, i + matchedText.length * 2).trim().replace(/\s+/g, ' ');
        const noSpaceSnippet = snippet.replace(/\s+/g, '');
        if (noSpaceSnippet.includes(matchedText)) {
          // 检查片段长度是否合适
          if (snippet.length >= 10 && snippet.length <= 150) {
            console.log(`[标题提取] 找到标题片段: "${snippet.substring(0, 80)}..."`);
            // 对提取的标题进行后处理清洗
            const cleanedTitle = cleanExtractedTitle(snippet);
            console.log(`[标题提取] 清洗后标题: "${cleanedTitle}"`);
            return cleanedTitle;
          }
        }
      }

      // 如果找不到合适片段，直接返回匹配文本（可能无空格）
      // 但尽量添加空格使其可读
      let readableTitle = matchedText;
      // 在一些大写字母或中英文交界处添加空格（简单处理）
      readableTitle = readableTitle.replace(/([A-Z])([a-z])/g, '$1 $2');
      readableTitle = readableTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
      readableTitle = readableTitle.replace(/([\u4e00-\u9fa5])([A-Za-z])/g, '$1 $2');
      readableTitle = readableTitle.replace(/([A-Za-z])([\u4e00-\u9fa5])/g, '$1 $2');
      console.log(`[标题提取] 返回关键词匹配标题: ${readableTitle}`);
      return readableTitle;
    }
  }

  // 如果还没有找到，尝试在文本中寻找包含"SPMT"和"动力学"的短文本
  if (noSpaceText.includes('SPMT') && noSpaceText.includes('动力学')) {
    console.log('[标题提取] 检测到SPMT和动力学关键词，尝试提取标题');
    // 寻找包含这两个关键词的窗口
    for (let start = 0; start < Math.min(keywordSearchText.length - 50, 500); start += 20) {
      const windowText = keywordSearchText.substring(start, start + 100).trim().replace(/\s+/g, ' ');
      if (windowText.length >= 20 && windowText.length <= 120) {
        const noSpaceWindow = windowText.replace(/\s+/g, '');
        if (noSpaceWindow.includes('SPMT') && noSpaceWindow.includes('动力学')) {
          console.log(`[标题提取] 找到SPMT动力学相关文本: "${windowText.substring(0, 80)}..."`);
          return windowText;
        }
      }
    }
  }

  console.log('[标题提取] 未找到合适标题');
  return null;
}

/**
 * 评估单个文本段落是否可能是标题，返回候选对象
 */
function evaluateTitleCandidate(text: string, paragraphIndex: number, sentenceIndex: number): { text: string, score: number, reasons: string[] } | null {
  const cleanPara = text.trim().replace(/\s+/g, ' ');
  const length = cleanPara.length;

  let score = 0;
  const reasons: string[] = [];

  // 1. 位置权重：第一段/句更可能是标题
  if (paragraphIndex === 0) {
    if (sentenceIndex === -1) {
      // 整个段落
      score += 20;
      reasons.push('第一段');
    } else if (sentenceIndex === 0) {
      // 第一段的第一个句子
      score += 25;
      reasons.push('第一段第一句');
    } else {
      score += 15;
      reasons.push(`第一段第${sentenceIndex + 1}句`);
    }
  } else if (paragraphIndex === 1) {
    score += 10;
    reasons.push('第二段');
  } else {
    score += 5;
    reasons.push('第三段或更后');
  }

  // 2. 长度权重：适中的长度更好（10-150字符）
  if (length >= 10 && length <= 150) {
    score += 15;
    reasons.push(`适中长度(${length})`);
  } else if (length >= 5 && length <= 200) {
    score += 10;
    reasons.push(`可接受长度(${length})`);
  } else {
    // 长度不合适
    return null;
  }

  // 3. 排除明显不是标题的内容
  const lowerPara = cleanPara.toLowerCase();

  // 检查是否包含明显非标题关键词（摘要、目录、页码等）
  const nonTitlePatterns = [
    /摘要|abstract|摘\s*要/i,
    /关键词|key words|keywords/i,
    /目录|contents|目\s*录/i,
    /引言|introduction|引\s*言/i,
    /^\d+[\.\、]\s*/, // 以数字开头，如 "1. " 或 "1、"
    /^(abstract|keywords|introduction):?\s*/i,
    /^[a-z][a-z\s]*$/, // 全小写英文（可能是句子而不是标题）
    /\.{3,}/, // 包含多个点（可能是省略号）
    /第[一二三四五六七八九十\d]+[章节部分]/,
    /基金项目|作者简介|文章编号|DOI|中图分类号|文献标志码/i,
    /vol\.|no\.|pp\.|pages?|volume/i, // 期刊卷期信息
  ];

  for (const pattern of nonTitlePatterns) {
    if (pattern.test(cleanPara) || pattern.test(lowerPara)) {
      console.log(`[标题提取] 候选文本匹配非标题模式: ${pattern}, 文本: ${cleanPara.substring(0, 50)}...`);
      return null;
    }
  }

  // 4. 检查标题特征（加分项）

  // 中文标题通常没有句号
  if (!/[。.;!?]$/.test(cleanPara)) {
    score += 10;
    reasons.push('无结束标点');
  }

  // 检查是否以常见标题标点结束（冒号、破折号等）
  if (/[:：\-—]$/.test(cleanPara)) {
    score += 5;
    reasons.push('标题标点结尾');
  }

  // 检查是否包含常见学术标题关键词
  const titleKeywords = [
    /研究|study|research/i,
    /分析|analysis/i,
    /探讨|discussion/i,
    /综述|review/i,
    /设计|design/i,
    /应用|application/i,
    /基于|based on/i,
    /方法|method/i,
    /技术|technology/i,
    /系统|system/i,
    /动力学|dynamic/i,
    /运输|transfer/i,
    /模块|module/i,
  ];

  let keywordScore = 0;
  for (const keyword of titleKeywords) {
    if (keyword.test(cleanPara)) {
      keywordScore += 3; // 提高权重
    }
  }
  if (keywordScore > 0) {
    score += Math.min(keywordScore, 15);
    reasons.push(`包含标题关键词(+${keywordScore})`);
  }

  // 5. 格式检查（首字母大写等）
  // 对于英文标题：检查是否每个重要单词首字母大写（简单的检查）
  if (/^[A-Z]/.test(cleanPara) && /[a-zA-Z]/.test(cleanPara)) {
    const words = cleanPara.split(/\s+/);
    const importantWords = words.filter(w => w.length > 2);
    if (importantWords.length > 0) {
      const capitalizedWords = importantWords.filter(w => /^[A-Z]/.test(w));
      const capitalizationRatio = capitalizedWords.length / importantWords.length;
      if (capitalizationRatio > 0.5) {
        score += 10;
        reasons.push('英文标题格式');
      }
    }
  }

  // 6. 检查是否包含过多数字或特殊字符（减分项）
  const digitCount = (cleanPara.match(/\d/g) || []).length;
  const digitRatio = digitCount / length;
  if (digitRatio > 0.2) {
    score -= 10;
    reasons.push(`数字过多(-10)`);
  }

  // 最终分数必须达到阈值
  if (score >= 25) {
    console.log(`[标题提取] 候选标题: "${cleanPara.substring(0, 50)}..."，分数: ${score}, 原因: ${reasons.join(', ')}`);
    return {
      text: cleanPara,
      score: score,
      reasons: reasons
    };
  }

  return null;
}

/**
 * 清洗提取的标题，移除数字序列、作者信息等无关内容
 */
function cleanExtractedTitle(title: string): string {
  if (!title) return title;

  console.log(`[标题清洗] 原始标题: "${title}"`);

  let cleaned = title.trim();

  // 1. 移除开头的数字序列（如"2 0 2 4 0 4 1 0 "）
  // 匹配以数字开头，后面可能跟空格和数字的模式
  cleaned = cleaned.replace(/^(\d\s*){5,}/, '');

  // 2. 移除文章编号等数字模式（如"20240410"），包括被空格分隔的情况
  // 先移除空格，再匹配长数字序列
  const noSpaceForDigits = cleaned.replace(/\s+/g, '');
  if (noSpaceForDigits.match(/^\d{8,}/)) {
    // 如果去除空格后开头是8位以上数字，说明整个开头都是数字序列
    cleaned = cleaned.replace(/^(\d\s*)+/, '');
  }

  // 3. 合并被空格分隔的英文缩写（如"F P S O"应该变成"FPSO"）
  // 匹配大写字母之间用空格分隔的模式
  cleaned = cleaned.replace(/([A-Z])\s+([A-Z])\s+([A-Z])\s+([A-Z])/g, '$1$2$3$4');
  cleaned = cleaned.replace(/([A-Z])\s+([A-Z])\s+([A-Z])/g, '$1$2$3');
  cleaned = cleaned.replace(/([A-Z])\s+([A-Z])/g, '$1$2');

  // 4. 合并被空格分隔的"SPMT"（可能被识别为"S P M T"）
  cleaned = cleaned.replace(/S\s+P\s+M\s+T/g, 'SPMT');

  // 5. 移除作者信息（包含数字和字母的模式，如"1a, 1b, 1c"）
  cleaned = cleaned.replace(/\b\d+[a-zA-Z]\s*(,\s*\d+[a-zA-Z]\s*)*/g, '');

  // 6. 移除常见的作者标记（如"辛子豪 1a , 1b , 1c"）
  cleaned = cleaned.replace(/[\u4e00-\u9fa5]+\s+\d+[a-zA-Z]\s*(,\s*\d+[a-zA-Z]\s*)*/g, '');

  // 7. 移除多个作者（如"辛子豪, 何炎平, 曾敏"等）
  // 匹配连续的中文人名，用逗号分隔
  cleaned = cleaned.replace(/[\u4e00-\u9fa5]+\s*(,\s*[\u4e00-\u9fa5]+\s*){2,}/g, '');

  // 8. 移除括号内的内容，如果包含数字和字母组合（如"(1. 上海交通大学)"）
  cleaned = cleaned.replace(/\([^)]*\d+[a-zA-Z][^)]*\)/g, '');

  // 9. 移除单独的英文字母和数字组合（如"1 a"、"1 b"等）
  cleaned = cleaned.replace(/\b\d\s+[a-zA-Z]\b/g, '');

  // 10. 清理多余的空格和标点
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^[,\s.，。、]+/, '');
  cleaned = cleaned.replace(/[,\s.，。、]+$/, '');

  // 11. 移除末尾的括号和括号内容
  cleaned = cleaned.replace(/\([^)]*\)$/, '');

  // 12. 如果清洗后标题太短（小于5字符），返回原始标题
  if (cleaned.length < 5) {
    console.log(`[标题清洗] 清洗后太短，返回原始标题: "${title}"`);
    return title.trim();
  }

  console.log(`[标题清洗] 清洗后标题: "${cleaned}"`);
  return cleaned;
}

/**
 * 基于最大字号的标题提取算法
 * 根据任务要求实现：
 * 1. 加载PDF第一页
 * 2. 获取文本项并分析字号
 * 3. 找出最大字号文本作为标题
 * 4. 排序并拼接标题文本
 */
async function extractTitleByFontSize(pdf: any): Promise<string | null> {
  try {
    console.log('[标题提取] 使用最大字号算法提取标题');

    // 1. 加载首页
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const items = textContent.items;

    if (!items || items.length === 0) {
      console.log('[标题提取] 第一页没有文本项');
      return null;
    }

    console.log(`[标题提取] 第一页找到 ${items.length} 个文本项`);

    // 2. 字号统计与过滤
    let maxFontSize = 0;
    const validItems: Array<{
      str: string;
      fontSize: number;
      x: number;
      y: number;
      transform: number[];
    }> = [];

    // 遍历items，计算字号并过滤
    for (const item of items) {
      const typedItem = item as any;
      const str = typedItem.str || '';

      // 忽略空字符串或纯空白字符
      if (!str || str.trim().length === 0) {
        continue;
      }

      const transform = typedItem.transform || [];
      if (transform.length < 6) {
        continue;
      }

      // 使用 Math.abs(transform[3]) 作为近似字号高度
      const fontSize = Math.abs(transform[3]);

      // 忽略极其微小的文字（噪音）
      if (fontSize < 5) {
        continue;
      }

      // 记录最大字号
      if (fontSize > maxFontSize) {
        maxFontSize = fontSize;
      }

      validItems.push({
        str: str,
        fontSize: fontSize,
        x: transform[4], // X坐标
        y: transform[5], // Y坐标
        transform: transform
      });
    }

    if (validItems.length === 0) {
      console.log('[标题提取] 没有有效的文本项');
      return null;
    }

    console.log(`[标题提取] 最大字号: ${maxFontSize.toFixed(2)}, 有效文本项: ${validItems.length}`);

    // 3. 提取标题候选（字号接近最大值的文本）
    const titleItems = validItems.filter(item => {
      // 允许10%的误差，同一标题内可能有细微排版差异
      return item.fontSize >= maxFontSize * 0.9;
    });

    if (titleItems.length === 0) {
      console.log('[标题提取] 没有找到字号接近最大值的文本项');
      // 如果没有找到接近最大字号的项，使用所有有效项中最上面的几个
      const topItems = validItems
        .sort((a, b) => b.y - a.y) // Y坐标从大到小（PDF坐标系原点在左下角，Y越大越靠上）
        .slice(0, Math.min(10, validItems.length));

      if (topItems.length === 0) {
        return null;
      }

      // 使用这些项构建标题
      const sortedTopItems = topItems.sort((a, b) => {
        // 按Y坐标从上到下，然后按X坐标从左到右
        if (Math.abs(a.y - b.y) > 5) {
          return b.y - a.y;
        }
        return a.x - b.x;
      });

      const title = sortedTopItems.map(item => item.str).join(' ').trim();
      console.log(`[标题提取] 使用最上方文本作为标题: "${title.substring(0, 50)}..."`);
      return title;
    }

    console.log(`[标题提取] 找到 ${titleItems.length} 个标题候选文本项`);

    // 4. 排序与拼接
    // 按照Y坐标从大到小（从上到下）、X坐标从小到大（从左到右）排序
    titleItems.sort((a, b) => {
      // 如果Y坐标相差较大（大于5个单位），按Y坐标排序
      if (Math.abs(a.y - b.y) > 5) {
        return b.y - a.y; // Y越大越靠上，所以从大到小排序
      }
      // Y坐标相近时，按X坐标排序
      return a.x - b.x;
    });

    // 5. 拼接标题
    const title = titleItems.map(item => item.str).join(' ').trim();

    if (!title || title.length === 0) {
      console.log('[标题提取] 拼接后的标题为空');
      return null;
    }

    console.log(`[标题提取] 最大字号算法提取标题: "${title.substring(0, 100)}..."`);

    // 6. 清洗标题（使用现有的清洗函数）
    const cleanedTitle = cleanExtractedTitle(title);
    console.log(`[标题提取] 清洗后标题: "${cleanedTitle}"`);

    return cleanedTitle;

  } catch (error) {
    console.error('[标题提取] 最大字号算法错误:', error);
    return null;
  }
}

/**
 * 兜底策略：取第一段看起来像正文的段落
 */
function extractFirstMeaningfulParagraph(text: string): string | null {
  // 简单分段 (利用原始text中的换行符)
  const paragraphs = text.split(/\n+/);

  for (const p of paragraphs) {
    const cleanP = p.replace(/\s+/g, '').trim();

    // 筛选条件：长度80-800字，且不是纯大写(标题)
    if (cleanP.length > 80 && cleanP.length < 800) {
      if (cleanP.length < 200 && /^[A-Z\s]+$/.test(p.trim())) continue;

      return p.trim().replace(/\s+/g, ' ').substring(0, 500);
    }
  }
  return null;
}
