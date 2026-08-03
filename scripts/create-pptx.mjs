import pptxgen from "pptxgenjs";
import React from "react";
import ReactDOMServer from "react-dom/server";
import sharp from "sharp";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  FaEdit, FaRobot, FaFileExport, FaDatabase, FaShieldAlt,
  FaProjectDiagram, FaReact, FaCogs, FaLightbulb,
  FaSearch, FaFilePdf, FaPrint, FaGlobe, FaBookOpen,
  FaCode, FaPalette, FaServer, FaLock, FaBrain
} from "react-icons/fa";

// ── Color Palette ──
const C = {
  dark:    "0F172A",
  navy:    "1E3A5F",
  primary: "2563EB",
  cyan:    "0891B2",
  lightBg: "F8FAFC",
  cardBg:  "FFFFFF",
  text:    "1E293B",
  muted:   "64748B",
  accent:  "F59E0B",
  blue50:  "EFF6FF",
  blue100: "DBEAFE",
  blue200: "BFDBFE",
  border:  "E2E8F0",
  green:   "10B981",
  purple:  "8B5CF6",
  red:     "EF4444",
};

const FONT = "Microsoft YaHei";
const FONT_BOLD = "Microsoft YaHei";

// ── Icon Helper ──
function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ── Reusable shape factories (avoid mutation reuse bug) ──
const makeShadow = () => ({ type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.08 });

// ── Presentation Setup ──
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "SWS 工法情报收集系统";
pres.title = "工法情报编辑器 — 产品介绍";

// ── Pre-render all icons ──
const icons = {};
for (const [name, comp, color] of [
  ["edit",      FaEdit,           "#2563EB"],
  ["robot",     FaRobot,          "#8B5CF6"],
  ["export",    FaFileExport,     "#0891B2"],
  ["graph",     FaProjectDiagram, "#F59E0B"],
  ["reactIcon", FaReact,          "#2563EB"],
  ["cogs",      FaCogs,           "#64748B"],
  ["bulb",      FaLightbulb,      "#F59E0B"],
  ["search",    FaSearch,         "#2563EB"],
  ["pdf",       FaFilePdf,        "#EF4444"],
  ["print",     FaPrint,          "#10B981"],
  ["globe",     FaGlobe,          "#0891B2"],
  ["book",      FaBookOpen,       "#2563EB"],
  ["code",      FaCode,           "#1E293B"],
  ["server",    FaServer,         "#64748B"],
  ["lock",      FaLock,           "#10B981"],
  ["shield",    FaShieldAlt,      "#2563EB"],
  ["brain",     FaBrain,          "#8B5CF6"],
  ["database",  FaDatabase,       "#0891B2"],
  ["palette",   FaPalette,        "#F59E0B"],
]) {
  icons[name] = await iconToBase64(comp, color, 256);
}
// White variants for dark slides
for (const [name, comp] of [
  ["edit_w",    FaEdit],
  ["robot_w",   FaRobot],
  ["cogs_w",    FaCogs],
  ["shield_w",  FaShieldAlt],
]) {
  icons[name] = await iconToBase64(comp, "#FFFFFF", 256);
}

console.log("Icons rendered.");

// ═══════════════════════════════════════
// SLIDE 1 — TITLE
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  // Subtle decorative shapes
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.06, fill: { color: C.primary } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.565, w: 10, h: 0.06, fill: { color: C.primary } });

  // Decorative abstract shape top-right
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: -1.5, w: 5, h: 5,
    fill: { color: C.primary, transparency: 85 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 8.2, y: 2.5, w: 3, h: 3,
    fill: { color: C.cyan, transparency: 90 }
  });

  // Main title
  s.addText("工法情报编辑器", {
    x: 0.8, y: 1.2, w: 8.4, h: 1.0,
    fontSize: 44, fontFace: FONT_BOLD, color: "FFFFFF",
    bold: true, margin: 0
  });

  // English subtitle
  s.addText("Construction Method Intelligence Editor", {
    x: 0.8, y: 2.2, w: 8.4, h: 0.5,
    fontSize: 20, fontFace: FONT, color: C.blue200, margin: 0
  });

  // Divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 2.95, w: 1.2, h: 0.04, fill: { color: C.accent }
  });

  // Description
  s.addText("面向建筑工程领域的智能情报收集、编辑与发布平台", {
    x: 0.8, y: 3.2, w: 8.4, h: 0.6,
    fontSize: 16, fontFace: FONT, color: C.muted, margin: 0
  });

  // Version + meta
  s.addText([
    { text: "v1.8.0", options: { fontSize: 14, color: C.muted } },
    { text: "    ·    ", options: { fontSize: 14, color: "334155" } },
    { text: "React 19 + TypeScript + Vite 6", options: { fontSize: 14, color: C.muted } },
    { text: "    ·    ", options: { fontSize: 14, color: "334155" } },
    { text: "SWS 项目组", options: { fontSize: 14, color: C.muted } },
  ], {
    x: 0.8, y: 4.4, w: 8.4, h: 0.4, fontFace: FONT, margin: 0
  });
}

// ═══════════════════════════════════════
// SLIDE 2 — 项目概述
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  // Section title
  s.addText("项目概述", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("PROJECT OVERVIEW", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  // Left: description card
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.5, w: 5.8, h: 3.4,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.5, w: 0.07, h: 3.4, fill: { color: C.primary }
  });

  s.addText([
    { text: "工法情报编辑器", options: { bold: true, fontSize: 18, color: C.text, breakLine: true } },
    { text: "", options: { fontSize: 6, breakLine: true } },
    { text: "一款专为建筑工程领域设计的全栈情报编辑与出版系统。", options: { fontSize: 13, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 6, breakLine: true } },
    { text: "集成富文本编辑、AI 智能辅助、多格式导出、本地数据持久化等核心能力，覆盖从情报采集、编辑排版到印刷发布的完整工作流程。", options: { fontSize: 13, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 6, breakLine: true } },
    { text: "采用 BFF 安全代理架构，确保 AI API Key 不暴露至前端，支持完全离线使用。", options: { fontSize: 13, color: C.muted } },
  ], {
    x: 1.0, y: 1.7, w: 5.3, h: 3.0, fontFace: FONT, valign: "top", margin: 0
  });

  // Right: stat cards
  const stats = [
    { num: "13", label: "内容块类型", color: C.primary },
    { num: "4", label: "AI 智能功能", color: C.purple },
    { num: "3", label: "导出格式", color: C.cyan },
    { num: "4+", label: "数据来源渠道", color: C.accent },
  ];

  stats.forEach((st, i) => {
    const y = 1.5 + i * 0.88;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.8, y, w: 2.5, h: 0.73,
      fill: { color: C.cardBg }, shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.8, y, w: 0.06, h: 0.73, fill: { color: st.color }
    });
    s.addText(st.num, {
      x: 7.1, y: y + 0.05, w: 1.0, h: 0.4,
      fontSize: 24, fontFace: FONT_BOLD, color: st.color, bold: true, margin: 0
    });
    s.addText(st.label, {
      x: 7.1, y: y + 0.42, w: 2.0, h: 0.25,
      fontSize: 11, fontFace: FONT, color: C.muted, margin: 0
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 3 — 技术栈
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("技术栈", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("TECH STACK", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  const techs = [
    { icon: icons.reactIcon, name: "React 19", desc: "前端 UI 框架", color: "61DAFB" },
    { icon: icons.code, name: "TypeScript 5.8", desc: "类型安全", color: "3178C6" },
    { icon: icons.cogs, name: "Vite 6", desc: "构建工具", color: "646CFF" },
    { icon: icons.palette, name: "TailwindCSS v4", desc: "样式框架", color: "06B6D4" },
    { icon: icons.server, name: "Express 5", desc: "BFF 代理层", color: "000000" },
    { icon: icons.database, name: "IndexedDB", desc: "本地数据持久化", color: C.cyan },
    { icon: icons.brain, name: "DeepSeek API", desc: "AI 大语言模型", color: C.purple },
    { icon: icons.shield, name: "Vitest + jsdom", desc: "测试框架", color: C.green },
  ];

  const cols = 4;
  const cardW = 2.05;
  const cardH = 1.55;
  const gapX = 0.18;
  const gapY = 0.2;
  const startX = 0.7;
  const startY = 1.4;

  techs.forEach((tech, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.cardBg }, shadow: makeShadow()
    });

    // Icon
    s.addImage({ data: tech.icon, x: x + 0.75, y: y + 0.2, w: 0.55, h: 0.55 });

    // Name
    s.addText(tech.name, {
      x: x + 0.15, y: y + 0.85, w: cardW - 0.3, h: 0.32,
      fontSize: 13, fontFace: FONT_BOLD, color: C.text, bold: true, align: "center", margin: 0
    });
    // Desc
    s.addText(tech.desc, {
      x: x + 0.15, y: y + 1.15, w: cardW - 0.3, h: 0.28,
      fontSize: 10, fontFace: FONT, color: C.muted, align: "center", margin: 0
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 4 — 核心功能概览
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("核心功能概览", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("KEY FEATURES", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  const features = [
    { icon: icons.edit, title: "富文本编辑器", desc: "13 种内容块类型，支持\图片/视频/音频/PDF 等多媒体混排", color: C.primary },
    { icon: icons.robot, title: "AI 智能辅助", desc: "元数据生成、卷首语撰写、\知识图谱构建、选题智能评审", color: C.purple },
    { icon: icons.export, title: "多格式导出", desc: "离线 Reader 阅读器、\打印版、PDF 版一键导出", color: C.cyan },
    { icon: icons.graph, title: "知识图谱", desc: "基于 d3.js 的交互式\知识图谱可视化渲染", color: C.accent },
  ];

  const cardW = 4.2;
  const cardH = 1.65;
  const gapX = 0.25;
  const gapY = 0.25;
  const startX = 0.7;
  const startY = 1.4;

  features.forEach((feat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.cardBg }, shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.07, h: cardH, fill: { color: feat.color }
    });

    // Icon
    s.addImage({ data: feat.icon, x: x + 0.25, y: y + 0.35, w: 0.55, h: 0.55 });

    // Title
    s.addText(feat.title, {
      x: x + 0.95, y: y + 0.2, w: cardW - 1.2, h: 0.35,
      fontSize: 16, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
    });
    // Description
    s.addText(feat.desc, {
      x: x + 0.95, y: y + 0.6, w: cardW - 1.2, h: 0.8,
      fontSize: 12, fontFace: FONT, color: C.muted, margin: 0
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 5 — 富文本编辑器
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("富文本编辑器", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("RICH TEXT EDITOR", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  // Left description
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 4.3, h: 3.5,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 0.07, h: 3.5, fill: { color: C.primary }
  });

  s.addText([
    { text: "架构设计", options: { bold: true, fontSize: 16, color: C.text, breakLine: true } },
    { text: "", options: { fontSize: 5, breakLine: true } },
    { text: "6 个专用 Hook 拆分编辑器职责：", options: { fontSize: 12, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 4, breakLine: true } },
    { text: "useEditorState", options: { bold: true, fontSize: 11, color: C.primary, breakLine: true } },
    { text: "编辑状态管理（content、blocks、脏标记）", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "useEditorCommands", options: { bold: true, fontSize: 11, color: C.primary, breakLine: true } },
    { text: "格式化、插入块、撤销/重做", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "useEditorKeyboard", options: { bold: true, fontSize: 11, color: C.primary, breakLine: true } },
    { text: "快捷键绑定", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "useFileUpload", options: { bold: true, fontSize: 11, color: C.primary, breakLine: true } },
    { text: "文件上传与图片压缩", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "useImageToolbar", options: { bold: true, fontSize: 11, color: C.primary, breakLine: true } },
    { text: "图片选中浮动工具栏", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "useSelection", options: { bold: true, fontSize: 11, color: C.primary, breakLine: true } },
    { text: "光标与选区管理", options: { fontSize: 10, color: C.muted } },
  ], {
    x: 0.95, y: 1.55, w: 3.9, h: 3.2, fontFace: FONT, valign: "top", margin: 0
  });

  // Right: 13 block types
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.25, y: 1.4, w: 4.05, h: 3.5,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.25, y: 1.4, w: 0.07, h: 3.5, fill: { color: C.accent }
  });

  s.addText("13 种内容块类型", {
    x: 5.5, y: 1.55, w: 3.6, h: 0.35,
    fontSize: 16, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });

  const blockTypes = [
    "📝 段落 Paragraph", "📌 标题 Heading (H1-H6)",
    "🖼️ 图片 Image", "🎬 视频 Video",
    "🔊 音频 Audio", "📄 PDF 附件",
    "💬 引用 Blockquote", "📋 列表 List",
    "📊 表格 Table", "💻 代码 Code",
    "➖ 分割线 HR", "📈 图表 Figure",
    "🏷️ 原始 HTML",
  ];

  blockTypes.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = 5.5 + col * 1.85;
    const by = 2.05 + row * 0.38;

    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: by, w: 0.22, h: 0.22,
      fill: { color: C.blue100 }
    });
    s.addText(b, {
      x: bx + 0.3, y: by, w: 1.5, h: 0.26,
      fontSize: 10, fontFace: FONT, color: C.text, margin: 0
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 6 — AI 智能辅助
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("AI 智能辅助", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("AI-POWERED FEATURES", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  const aiFeatures = [
    {
      icon: icons.robot, title: "元数据生成",
      desc: "AI 自动提取文章标题、摘要、关键词标签，减少人工录入",
      color: C.purple
    },
    {
      icon: icons.book, title: "卷首语撰写",
      desc: "基于期刊内容，自动生成专业卷首语，风格可定制",
      color: C.primary
    },
    {
      icon: icons.graph, title: "知识图谱构建",
      desc: "从文本中抽取实体关系，自动构建交互式知识图谱",
      color: C.accent
    },
    {
      icon: icons.search, title: "选题智能评审",
      desc: "多源情报聚合分析，AI 辅助决策推荐/待定/淘汰",
      color: C.cyan
    },
  ];

  const cardW = 4.2;
  const cardH = 1.65;
  const gapX = 0.25;
  const gapY = 0.25;
  const startX = 0.7;
  const startY = 1.4;

  aiFeatures.forEach((feat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.cardBg }, shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.07, h: cardH, fill: { color: feat.color }
    });

    s.addImage({ data: feat.icon, x: x + 0.25, y: y + 0.35, w: 0.55, h: 0.55 });

    s.addText(feat.title, {
      x: x + 0.95, y: y + 0.2, w: cardW - 1.2, h: 0.35,
      fontSize: 16, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
    });
    s.addText(feat.desc, {
      x: x + 0.95, y: y + 0.6, w: cardW - 1.2, h: 0.8,
      fontSize: 12, fontFace: FONT, color: C.muted, margin: 0
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 7 — 多格式导出
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("多格式导出", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("MULTI-FORMAT EXPORT", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  const exports = [
    {
      icon: icons.globe, title: "离线 Reader 版",
      desc: "单 HTML 文件，所有资源（JS/CSS/字体/图片/PDF Worker）Base64 内联，真正离线可用",
      highlights: ["完全离线", "单文件分发", "~15MB 自包含"],
      color: C.primary
    },
    {
      icon: icons.print, title: "打印版",
      desc: "A4 纸张精确排版，自动分页，适合印刷出版",
      highlights: ["A4 排版", "印刷级质量", "自动分页"],
      color: C.green
    },
    {
      icon: icons.pdf, title: "PDF 电子版",
      desc: "基于 @react-pdf/renderer，可配置元数据，适合数字分发和归档",
      highlights: ["矢量文字", "元数据嵌入", "数字签名"],
      color: C.red
    },
  ];

  const cardW = 2.8;
  const cardH = 3.2;
  const startX = 0.7;
  const gap = 0.2;
  const startY = 1.5;

  exports.forEach((exp, i) => {
    const x = startX + i * (cardW + gap);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: cardH,
      fill: { color: C.cardBg }, shadow: makeShadow()
    });

    // Top color bar
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: 0.06, fill: { color: exp.color }
    });

    // Icon
    s.addImage({ data: exp.icon, x: x + 1.0, y: startY + 0.3, w: 0.7, h: 0.7 });

    // Title
    s.addText(exp.title, {
      x: x + 0.2, y: startY + 1.15, w: cardW - 0.4, h: 0.35,
      fontSize: 16, fontFace: FONT_BOLD, color: C.text, bold: true, align: "center", margin: 0
    });

    // Description
    s.addText(exp.desc, {
      x: x + 0.2, y: startY + 1.55, w: cardW - 0.4, h: 0.85,
      fontSize: 11, fontFace: FONT, color: C.muted, align: "center", margin: 0
    });

    // Highlights
    exp.highlights.forEach((h, j) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.3, y: startY + 2.5 + j * 0.25, w: 0.16, h: 0.16,
        fill: { color: exp.color, transparency: 80 }
      });
      s.addText(h, {
        x: x + 0.55, y: startY + 2.48 + j * 0.25, w: cardW - 0.9, h: 0.2,
        fontSize: 10, fontFace: FONT, color: C.muted, margin: 0
      });
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 8 — 数据架构
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("数据架构", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("DATA ARCHITECTURE", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  // Left: data flow diagram (text-based)
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 5.5, h: 3.6,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 0.07, h: 3.6, fill: { color: C.primary }
  });

  // Flow boxes
  const flowSteps = [
    { label: "App.tsx", sub: "全局状态中枢", color: C.primary },
    { label: "Hooks", sub: "业务逻辑层", color: C.cyan },
    { label: "Services", sub: "数据处理层", color: C.purple },
    { label: "IndexedDB", sub: "本地持久化存储", color: C.accent },
  ];

  flowSteps.forEach((step, i) => {
    const fy = 1.7 + i * 0.75;

    // Box
    s.addShape(pres.shapes.RECTANGLE, {
      x: 1.0, y: fy, w: 2.2, h: 0.55,
      fill: { color: step.color, transparency: 90 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 1.0, y: fy, w: 0.06, h: 0.55, fill: { color: step.color }
    });
    s.addText(step.label, {
      x: 1.2, y: fy + 0.02, w: 1.8, h: 0.28,
      fontSize: 13, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
    });
    s.addText(step.sub, {
      x: 1.2, y: fy + 0.3, w: 1.8, h: 0.2,
      fontSize: 10, fontFace: FONT, color: C.muted, margin: 0
    });

    // Arrow (except last)
    if (i < flowSteps.length - 1) {
      s.addText("▼", {
        x: 1.9, y: fy + 0.55, w: 0.4, h: 0.22,
        fontSize: 14, color: C.muted, align: "center", margin: 0
      });
    }
  });

  // Right arrow to components
  s.addText("▶", {
    x: 3.5, y: 2.8, w: 0.5, h: 0.4,
    fontSize: 20, color: C.muted, align: "center", margin: 0
  });

  // Components box
  s.addShape(pres.shapes.RECTANGLE, {
    x: 4.0, y: 2.4, w: 2.0, h: 1.0,
    fill: { color: C.green, transparency: 90 }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 4.0, y: 2.4, w: 0.06, h: 1.0, fill: { color: C.green }
  });
  s.addText("组件渲染", {
    x: 4.2, y: 2.55, w: 1.6, h: 0.35,
    fontSize: 13, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("PaperView / Sidebar\nEditor / Renderers", {
    x: 4.2, y: 2.95, w: 1.6, h: 0.42,
    fontSize: 9, fontFace: FONT, color: C.muted, margin: 0
  });

  // Right: key data model
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 1.4, w: 2.9, h: 3.6,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 1.4, w: 0.07, h: 3.6, fill: { color: C.accent }
  });

  s.addText("Article 实体", {
    x: 6.75, y: 1.55, w: 2.45, h: 0.3,
    fontSize: 14, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });

  const fields = [
    "id, title, category", "content (HTML)", "blocks (结构化)",
    "coverImage / backImage", "pdfData (附件)", "abstract / tags",
    "scale / posX / posY", "order (排序权重)", "fontSize / lineHeight",
  ];

  fields.forEach((f, i) => {
    s.addText(f, {
      x: 6.75, y: 1.95 + i * 0.3, w: 2.45, h: 0.25,
      fontSize: 10, fontFace: "Consolas", color: C.muted, margin: 0
    });
  });

  // Storage note
  s.addText("ContentBlock: 13 种联合类型", {
    x: 6.75, y: 4.65, w: 2.45, h: 0.2,
    fontSize: 9, fontFace: FONT, color: C.accent, italic: true, margin: 0
  });

  // ID generation note
  s.addText("ID: Date.now() × 1000 + 计数器", {
    x: 0.95, y: 4.65, w: 5.0, h: 0.2,
    fontSize: 9, fontFace: "Consolas", color: C.muted, margin: 0
  });
}

// ═══════════════════════════════════════
// SLIDE 9 — BFF 安全模型
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("BFF 安全模型", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("BACKEND-FOR-FRONTEND SECURITY", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  // Left: security flow
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 5.5, h: 3.6,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 0.07, h: 3.6, fill: { color: C.green }
  });

  // Flow diagram
  const secureFlow = [
    { label: "浏览器前端", sub: "不持有 API Key", color: C.primary, icon: icons.globe },
    { label: "x-sws-proxy-secret", sub: "请求头鉴权", color: C.accent, icon: icons.lock },
    { label: "Express BFF :3001", sub: "server.js 代理层", color: C.cyan, icon: icons.server },
    { label: "DeepSeek API", sub: "AI 大模型服务", color: C.purple, icon: icons.brain },
  ];

  secureFlow.forEach((step, i) => {
    const fy = 1.6 + i * 0.78;

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.95, y: fy, w: 4.8, h: 0.6,
      fill: { color: C.cardBg }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.95, y: fy, w: 0.05, h: 0.6, fill: { color: step.color }
    });

    s.addImage({ data: step.icon, x: 1.15, y: fy + 0.1, w: 0.4, h: 0.4 });

    s.addText(step.label, {
      x: 1.7, y: fy + 0.03, w: 2.5, h: 0.28,
      fontSize: 13, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
    });
    s.addText(step.sub, {
      x: 1.7, y: fy + 0.32, w: 3.5, h: 0.22,
      fontSize: 10, fontFace: FONT, color: C.muted, margin: 0
    });

    if (i < secureFlow.length - 1) {
      s.addText("▼", {
        x: 3.0, y: fy + 0.58, w: 0.4, h: 0.22,
        fontSize: 12, color: C.muted, align: "center", margin: 0
      });
    }
  });

  // Right: key points
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 1.4, w: 2.9, h: 3.6,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.5, y: 1.4, w: 0.07, h: 3.6, fill: { color: C.red }
  });

  s.addText("安全要点", {
    x: 6.75, y: 1.55, w: 2.45, h: 0.3,
    fontSize: 14, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });

  const secPoints = [
    "API Key 仅存于服务端\n环境变量 .env.local",
    "请求头鉴权防止\n未授权访问",
    "生产模式同时托管\ndist/ 静态资源",
    "300s 上游超时\nSIGTERM 优雅关闭",
    "请求体限制 5MB\n防止资源滥用",
    "开发环境仅允许\nlocalhost:3000 跨域",
  ];

  secPoints.forEach((p, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.75, y: 1.95 + i * 0.5, w: 0.18, h: 0.18,
      fill: { color: C.red, transparency: 80 }
    });
    s.addText("✓", {
      x: 6.75, y: 1.93 + i * 0.5, w: 0.18, h: 0.18,
      fontSize: 10, fontFace: FONT, color: C.red, align: "center", margin: 0
    });
    s.addText(p, {
      x: 7.05, y: 1.92 + i * 0.5, w: 2.2, h: 0.42,
      fontSize: 9, fontFace: FONT, color: C.muted, margin: 0
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 10 — 智能选题与知识图谱
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addText("智能选题与知识图谱", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });
  s.addText("AI CURATION & KNOWLEDGE GRAPH", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.muted, charSpacing: 4, margin: 0
  });

  // Left: AI Curation
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 4.3, h: 3.6,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: 1.4, w: 0.07, h: 3.6, fill: { color: C.cyan }
  });

  s.addText("AI 智能选题沙盘", {
    x: 0.95, y: 1.55, w: 3.8, h: 0.35,
    fontSize: 16, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });

  s.addText([
    { text: "多源情报聚合，AI 辅助决策", options: { fontSize: 12, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 5, breakLine: true } },
    { text: "数据来源：", options: { bold: true, fontSize: 12, color: C.text, breakLine: true } },
    { text: "微信公众号 · RSS 订阅 · 专利数据 · AI 生成", options: { fontSize: 11, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 5, breakLine: true } },
    { text: "评审决策：", options: { bold: true, fontSize: 12, color: C.text, breakLine: true } },
    { text: "推荐 (Recommend) · 待定 (Pending) · 淘汰 (Reject)", options: { fontSize: 11, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 5, breakLine: true } },
    { text: "双栏沙盘布局，左侧情报列表，右侧详情预览，支持拖拽排序与批量决策", options: { fontSize: 11, color: C.muted } },
  ], {
    x: 0.95, y: 2.0, w: 3.8, h: 2.8, fontFace: FONT, valign: "top", margin: 0
  });

  // Right: Knowledge Graph
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.25, y: 1.4, w: 4.05, h: 3.6,
    fill: { color: C.cardBg }, shadow: makeShadow()
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.25, y: 1.4, w: 0.07, h: 3.6, fill: { color: C.accent }
  });

  s.addText("知识图谱渲染", {
    x: 5.5, y: 1.55, w: 3.6, h: 0.35,
    fontSize: 16, fontFace: FONT_BOLD, color: C.text, bold: true, margin: 0
  });

  s.addText([
    { text: "基于 d3.js 的交互式知识图谱", options: { fontSize: 12, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 5, breakLine: true } },
    { text: "核心模块：", options: { bold: true, fontSize: 12, color: C.text, breakLine: true } },
    { text: "• QuadTree — 空间索引优化碰撞检测", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "• ForceEngine — 力导向布局算法", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "• Canvas 渲染器 — 高性能节点绘制", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 5, breakLine: true } },
    { text: "技术特点：", options: { bold: true, fontSize: 12, color: C.text, breakLine: true } },
    { text: "• 实体关系自动抽取", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "• 缩放/拖拽交互", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "• LRU 缓存 IndexedDB 持久化", options: { fontSize: 10, color: C.muted, breakLine: true } },
    { text: "• graphRenderer.ts 54KB 组装逻辑", options: { fontSize: 10, color: C.muted } },
  ], {
    x: 5.5, y: 2.0, w: 3.6, h: 2.8, fontFace: FONT, valign: "top", margin: 0
  });
}

// ═══════════════════════════════════════
// SLIDE 11 — 系统架构总览 (dark)
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: C.primary } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.575, w: 10, h: 0.05, fill: { color: C.primary } });

  s.addText("系统架构总览", {
    x: 0.7, y: 0.35, w: 8.6, h: 0.55,
    fontSize: 30, fontFace: FONT_BOLD, color: "FFFFFF", bold: true, margin: 0
  });
  s.addText("SYSTEM ARCHITECTURE", {
    x: 0.7, y: 0.85, w: 8.6, h: 0.3,
    fontSize: 11, fontFace: FONT, color: C.blue200, charSpacing: 4, margin: 0
  });

  // Architecture layers
  const layers = [
    {
      title: "表现层 Presentation",
      items: ["App.tsx 状态中枢", "Sidebar / Toolbar", "PaperView A4 预览", "Editor 富文本编辑器", "ArticleRenderer 分发渲染"],
      color: "3B82F6"
    },
    {
      title: "业务逻辑层 Business Logic",
      items: ["useJournal CRUD", "useAiFeatures AI 入口", "useExportManager 导出", "useImportManager 导入", "usePanZoom 图片操作"],
      color: "0891B2"
    },
    {
      title: "服务层 Services",
      items: ["db.ts IndexedDB 封装", "aiService.ts BFF 代理", "graphCache.ts 图谱缓存", "export/ 导出引擎", "pdf/ PDF 解析策略"],
      color: "8B5CF6"
    },
    {
      title: "基础设施 Infrastructure",
      items: ["Vite 6 构建工具", "Express BFF 代理", "IndexedDB 本地存储", "DeepSeek API", "Vitest + jsdom 测试"],
      color: "F59E0B"
    },
  ];

  const layerH = 1.02;
  const startY = 1.45;
  const gap = 0.12;

  layers.forEach((layer, i) => {
    const y = startY + i * (layerH + gap);

    // Layer background
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y, w: 8.6, h: layerH,
      fill: { color: "1E293B" }
    });
    // Left accent
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.7, y, w: 0.06, h: layerH, fill: { color: layer.color }
    });

    // Layer title
    s.addText(layer.title, {
      x: 1.0, y: y + 0.05, w: 2.8, h: 0.3,
      fontSize: 13, fontFace: FONT_BOLD, color: layer.color, bold: true, margin: 0
    });

    // Layer items
    layer.items.forEach((item, j) => {
      s.addText(item, {
        x: 1.0 + j * 1.65, y: y + 0.4, w: 1.55, h: 0.5,
        fontSize: 10, fontFace: FONT, color: "94A3B8", margin: 0
      });
    });
  });
}

// ═══════════════════════════════════════
// SLIDE 12 — 感谢页 (dark)
// ═══════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: C.primary } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.575, w: 10, h: 0.05, fill: { color: C.primary } });

  // Decorative circles
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: -1.5, w: 5, h: 5,
    fill: { color: C.primary, transparency: 88 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: -1.5, y: 3.0, w: 4, h: 4,
    fill: { color: C.cyan, transparency: 92 }
  });

  // Thank you
  s.addText("感谢聆听", {
    x: 0.8, y: 1.5, w: 8.4, h: 0.8,
    fontSize: 42, fontFace: FONT_BOLD, color: "FFFFFF", bold: true, margin: 0
  });

  s.addText("THANK YOU", {
    x: 0.8, y: 2.3, w: 8.4, h: 0.5,
    fontSize: 20, fontFace: FONT, color: C.blue200, charSpacing: 6, margin: 0
  });

  // Divider
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 3.05, w: 1.2, h: 0.04, fill: { color: C.accent }
  });

  // Info
  s.addText([
    { text: "工法情报编辑器 v1.8.0", options: { fontSize: 14, color: C.muted, breakLine: true } },
    { text: "SWS 工法情报收集系统", options: { fontSize: 14, color: C.muted, breakLine: true } },
    { text: "", options: { fontSize: 8, breakLine: true } },
    { text: "React 19 · TypeScript · Vite 6 · IndexedDB · DeepSeek API · d3.js", options: { fontSize: 11, color: "475569" } },
  ], {
    x: 0.8, y: 3.3, w: 8.4, h: 1.5, fontFace: FONT, margin: 0
  });
}

// ── Write file ──
// 相对脚本所在目录输出（原硬编码个人机器绝对路径，换机器/CI 必失败）
const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '工法情报编辑器-产品介绍.pptx');
await pres.writeFile({ fileName: outPath });
console.log("PPTX created: " + outPath);
