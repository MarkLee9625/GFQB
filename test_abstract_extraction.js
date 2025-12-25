// 复制优化后的findAbstractInText函数
function findAbstractInText(text) {
  if (!text) return null;

  // 定义摘要关键词（支持中英文、大小写）
  const abstractPatterns = [
    /摘要[:：]?\s*/,
    /abstract[:：]?\s*/i,
    /概要[:：]?\s*/,
    /内容提要[:：]?\s*/,
    /摘要\s+/,
    /abstract\s+/i
  ];

  let abstractStart = -1;
  let matchLength = 0;

  // 查找摘要起始位置
  for (const pattern of abstractPatterns) {
    const match = pattern.exec(text);
    if (match) {
      abstractStart = match.index;
      matchLength = match[0].length;
      break;
    }
  }

  if (abstractStart === -1) {
    // 如果没有找到摘要关键词，尝试提取第一段有意义的文本
    return extractFirstMeaningfulParagraph(text);
  }

  // 摘要起始位置：关键词后
  let contentStart = abstractStart + matchLength;
  
  // 跳过可能的标点符号和空白字符
  while (contentStart < text.length && /[：:。\.\s]/.test(text[contentStart])) {
    contentStart++;
  }

  // 查找摘要结束位置
  // 优先查找常见结束标记：关键词、引言、数字标题等
  const endPatterns = [
    /关键词[:：]?\s*/,
    /key\s+words[:：]?\s*/i,
    /keywords[:：]?\s*/i,
    /引言[:：]?\s*/,
    /introduction[:：]?\s*/i,
    /\n\s*\d+\./,  // 数字标题如 "1."
    /\n\s*[一二三四五六七八九十]+、/, // 中文数字标题
    /\n\s*[A-Z]\./, // 英文大写字母标题
    /\n\n\s*\n/, // 多个换行（段落结束）
  ];

  let abstractEnd = text.length;
  
  for (const pattern of endPatterns) {
    const match = pattern.exec(text.substring(contentStart));
    if (match && match.index < abstractEnd) {
      abstractEnd = contentStart + match.index;
    }
  }

  // 如果找到结束标记，确保摘要至少有一定长度（避免截取过短）
  if (abstractEnd < text.length && abstractEnd - contentStart < 50) {
    // 可能误判了结束位置，向后查找更合适的结束点
    const nextEndPatterns = [/\n\n/, /\n\s*[A-Z]/, /\n\s*[一二三四五六七八九十]+/];
    for (const pattern of nextEndPatterns) {
      const match = pattern.exec(text.substring(abstractEnd + 1));
      if (match) {
        abstractEnd = abstractEnd + 1 + match.index;
        break;
      }
    }
  }

  // 提取摘要文本
  let abstractText = text.substring(contentStart, abstractEnd).trim();
  
  // 清理文本：移除多余空格和换行，但保留段落结构
  abstractText = abstractText.replace(/\s+/g, ' ');
  abstractText = abstractText.replace(/\n+/g, ' ');
  
  // 如果摘要太长，尝试在句号处截断
  const MAX_LENGTH = 1000;
  if (abstractText.length > MAX_LENGTH) {
    // 优先在中文句号处截断
    const lastPeriod = abstractText.lastIndexOf('。', MAX_LENGTH);
    const lastDot = abstractText.lastIndexOf('.', MAX_LENGTH);
    const lastBreak = Math.max(lastPeriod, lastDot);
    
    if (lastBreak > 100) {
      abstractText = abstractText.substring(0, lastBreak + 1);
    } else {
      // 没有找到句号，尝试在逗号或分号处截断
      const lastComma = abstractText.lastIndexOf('，', MAX_LENGTH);
      const lastSemicolon = abstractText.lastIndexOf('；', MAX_LENGTH);
      const lastPunctuation = Math.max(lastComma, lastSemicolon);
      
      if (lastPunctuation > 100) {
        abstractText = abstractText.substring(0, lastPunctuation + 1);
      } else {
        // 直接截断并添加省略号
        abstractText = abstractText.substring(0, MAX_LENGTH) + '...';
      }
    }
  }

  // 进一步清理：移除可能的前导数字、符号等
  abstractText = abstractText.replace(/^[\d\s\.\-•]*/, '');
  
  return abstractText || null;
}

function extractFirstMeaningfulParagraph(text) {
  // 按段落分割
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // 寻找第一个有意义的段落（排除过短的段落）
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    // 段落长度在50-2000字符之间视为有意义
    if (trimmed.length >= 50 && trimmed.length <= 2000) {
      // 进一步清理
      return trimmed.replace(/\s+/g, ' ').substring(0, 500) + (trimmed.length > 500 ? '...' : '');
    }
  }
  
  // 如果没有找到合适段落，返回前500个字符
  if (text.length > 0) {
    return text.substring(0, Math.min(500, text.length)).trim() + (text.length > 500 ? '...' : '');
  }
  
  return null;
}

// 测试用例
const testCases = [
  {
    name: "标准中文摘要",
    text: "摘要：本文研究了工法情报系统的设计与实现。通过采用React和TypeScript，构建了一个现代化的编辑系统。关键词：工法情报；React；TypeScript。引言：随着信息技术的发展..."
  },
  {
    name: "标准英文摘要",
    text: "Abstract: This paper studies the design and implementation of a construction method intelligence system. Using React and TypeScript, we built a modern editing system. Keywords: construction method; React; TypeScript. Introduction: With the development of information technology..."
  },
  {
    name: "无摘要关键词，使用第一段",
    text: "本文研究了工法情报系统的设计与实现。通过采用React和TypeScript，构建了一个现代化的编辑系统。本文首先介绍了研究背景，然后详细阐述了系统设计。"
  },
  {
    name: "摘要后有关键词",
    text: "摘要: 本文研究工法情报系统。通过采用现代前端技术，实现了高效编辑。关键词：工法；情报；系统。引言：本文首先介绍背景。"
  },
  {
    name: "摘要后有多余空格",
    text: "摘要 :  本文研究工法情报系统。通过采用现代前端技术，实现了高效编辑。关键词：工法；情报；系统。"
  },
  {
    name: "摘要后换行",
    text: "摘要\n本文研究工法情报系统。通过采用现代前端技术，实现了高效编辑。\n关键词：工法；情报；系统。"
  }
];

console.log("开始测试摘要提取算法...\n");
testCases.forEach(testCase => {
  console.log(`测试用例: ${testCase.name}`);
  console.log(`输入文本: ${testCase.text.substring(0, 100)}...`);
  const result = findAbstractInText(testCase.text);
  console.log(`提取结果: ${result ? result.substring(0, 150) + (result.length > 150 ? '...' : '') : 'null'}`);
  console.log('---');
});
