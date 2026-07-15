import { KnowledgeGraphData } from '../../services/aiService';
import { generateGraphEngineCode, generateGraphStyles } from './graph/graphEngine';

export function generateGraphHtml(data: KnowledgeGraphData): string {
  // 数据清洗：规范化节点和连线 ID
  data.nodes.forEach(n => {
    n.id = String(n.id).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  });
  data.links.forEach(l => {
    l.source = String(l.source).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    l.target = String(l.target).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  });

  const validNodeIds = new Set(data.nodes.map(n => n.id));
  const originalLinkCount = data.links.length;

  data.links = data.links.filter(link =>
    validNodeIds.has(link.source) && validNodeIds.has(link.target)
  );

  if (data.links.length < originalLinkCount) {
    console.warn(`[安检门拦截] 已自动清理 ${originalLinkCount - data.links.length} 条大模型幻觉产生的无效幽灵连线。`);
  }

  // 使用 TextEncoder 替代已废弃的 unescape hack 进行 Unicode→Base64 编码
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(JSON.stringify(data));
  const binaryStr = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  const b64Data = btoa(binaryStr);

  // ================= 1. 静态 SVG 引擎 (专供打印) =================
  const width = 800; const height = 800;
  const cx = width / 2; const cy = height / 2; const radius = 280;

  let minWeight = Infinity;
  let maxWeight = -Infinity;
  if (data.nodes.length === 0) {
    minWeight = 0;
    maxWeight = 1;
  } else {
    data.nodes.forEach(node => {
      if (node.weight < minWeight) minWeight = node.weight;
      if (node.weight > maxWeight) maxWeight = node.weight;
    });
  }

  const svgNodes = data.nodes.map((n, i) => {
    const angle = (i / data.nodes.length) * 2 * Math.PI;
    const fontSizeRange = 14 - 9;
    const weightRatio = maxWeight === minWeight ? 0.5 : (n.weight - minWeight) / (maxWeight - minWeight);
    const fontSize = 9 + weightRatio * fontSizeRange;
    return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), fontSize };
  });

  const svgNodeMap = new Map(svgNodes.map(n => [n.id, n]));

  const linksHtml = data.links.map(link => {
    const source = svgNodeMap.get(link.source);
    const target = svgNodeMap.get(link.target);
    if (!source || !target) return '';
    return `
      <line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="#cbd5e1" stroke-width="${Math.min(link.strength || 1, 3)}" opacity="0.3" marker-end="url(#arrowhead)" />
    `;
  }).join('');

  const nodesHtml = svgNodes.map(node => {
    const colors: Record<string, string> = { technology: '#3b82f6', process: '#10b981', material: '#f59e0b', equipment: '#8b5cf6', concept: '#64748b' };
    const color = colors[node.type] || '#3b82f6';
    const r = 12 + (node.weight * 1.2);
    const fontSize = Math.round(node.fontSize);
    return `
      <g transform="translate(${node.x}, ${node.y})">
        <circle r="${r + 4}" fill="${color}" opacity="0.15" />
        <circle r="${r}" fill="${color}" />
        <text y="${r + 14}" text-anchor="middle" fill="#334155" font-size="${fontSize}" font-weight="bold"
              paint-order="stroke" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${node.name}
        </text>
      </g>
    `;
  }).join('');

  const staticSvgHtml = `
    <svg viewBox="0 0 800 800" style="width: 100%; max-width: 800px; height: auto; margin: 0 auto; display: block;">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
        </marker>
      </defs>
      ${linksHtml}
      ${nodesHtml}
      <circle cx="${cx}" cy="${cy}" r="45" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#0f172a" font-size="16" font-weight="900">SWS</text>
    </svg>
  `;

  // ================= 2. 交互引擎 =================
  // 从 graphEngine.ts 获取样式和引擎代码
  const graphStyles = generateGraphStyles();
  const engineScript = generateGraphEngineCode();

  // ================= 3. iframe 内壳 HTML =================
  const loaderSkeletonHtml = `
      <canvas id="graphCanvas"></canvas>
      <div class="legend-panel">
        <div class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span>技术</div>
        <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span>工艺</div>
        <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span>材料</div>
        <div class="legend-item"><span class="legend-dot" style="background:#8b5cf6"></span>设备</div>
        <div class="legend-item"><span class="legend-dot" style="background:#64748b"></span>理念</div>
      </div>
      <div class="search-box">
        <input id="searchInput" type="text" placeholder="🔍 搜索节点..." />
      </div>
      <div style="position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.85); backdrop-filter: blur(8px); padding: 8px 14px; border-radius: 8px; font-size: 12px; color: #334155; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; pointer-events: none; z-index: 5; font-weight: 500;">
        💡 <strong>交互提示：</strong>支持滚轮缩放与拖拽；<strong>双击</strong>带虚线圈的节点可下钻/收缩工艺细节。
      </div>
      <div id="tooltip" class="tooltip"></div>
      <div id="drawer" class="drawer">
        <button id="closeDrawer" class="drawer-close">×</button>
        <div class="drawer-header">
          <span id="drawerTag" class="tag" style="background: #e2e8f0; color: #475569; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;"></span>
          <h2 id="drawerTitle" class="drawer-title">节点名称</h2>
          <p id="drawerDesc" class="drawer-desc">节点描述</p>
        </div>
        <div style="flex:1; overflow-y: auto;">
          <div class="drawer-section-title">核心技术链路 (Links)</div>
          <div id="drawerLinks"></div>
        </div>
        <button id="traceBtn" class="action-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          在离线文章中检索全文
        </button>
      </div>
      <div class="zoom-controls">
        <button id="toggleExpand" class="zoom-btn zoom-text" title="展开/收起全部" style="width: auto; padding: 0 12px; margin-right: 10px;">展开全部</button>
        <button id="toggleLinks" class="zoom-btn zoom-text" title="切换连线密度" style="width: auto; padding: 0 12px; margin-right: 5px;">核心链路</button>
        <button id="zoomOut" class="zoom-btn" title="缩小">-</button>
        <button id="zoomReset" class="zoom-btn zoom-text" title="重置视图">100%</button>
        <button id="zoomIn" class="zoom-btn" title="放大">+</button>
        <button id="fullscreenBtn" class="zoom-btn" title="全屏" style="margin-left: 10px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
        </button>
      </div>
  `;

  const graphUid = 'sws-graph-' + Math.random().toString(36).substring(2, 11);

  // Iframe 内部 HTML (含 D3 加载回退 + 引擎注入)
  const loaderInternalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#f1f5f9; font-family: system-ui, -apple-system, sans-serif; }
    canvas { display: block; width: 100%; height: 100%; }
    .sws-graph-loading {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.9); z-index: 100; color: #666; font-size: 14px;
      text-align: center; padding: 20px;
    }
    .error-msg { color: #ef4444; font-size: 12px; margin-top: 8px; max-width: 80%; word-break: break-all; }
    ${graphStyles}
  </style>
</head>
<body>
  <div id="loading" class="sws-graph-loading">引擎启动中...</div>
  ${loaderSkeletonHtml}

  <script>
    (function() {
      var graphUid = "${graphUid}";
      console.log('[Graph] Iframe loader script started, UID: ' + graphUid);
      var initComplete = false;

      // 直接在 iframe 内部嵌入数据，避免跨帧 DOM 访问和 postMessage 链路问题
      var EMBEDDED_DATA_B64 = '${b64Data}';
      var retryCount = 0;
      var MAX_RETRIES = 40;
      var d3LoadAttempts = 0;
      var MAX_D3_LOAD_ATTEMPTS = 30;

      function showError(msg) {
        var el = document.getElementById('loading');
        if (el) {
          el.innerHTML = '图谱引擎启动失败<div class="error-msg">' + msg + '</div>';
          el.style.color = '#ef4444';
        }
      }

      // 使用 TextDecoder 替代废弃的 escape/unescape 进行 Base64→UTF8 解码
      function safeDecode(b64) {
        try {
          var binaryStr = atob(b64);
          var bytes = new Uint8Array(binaryStr.length);
          for (var i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          var decoder = new TextDecoder('utf-8');
          return JSON.parse(decoder.decode(bytes));
        } catch(e) {
          console.error('[Graph] Decode error:', e);
          return null;
        }
      }

      // 直接使用 iframe 内部嵌入的数据，不走跨帧 DOM 和 postMessage
      function bootstrap() {
        var data = safeDecode(EMBEDDED_DATA_B64);
        if (data) {
          console.log('[Graph] Using embedded data, starting engine...');
          startEngine(data);
        } else {
          showError('图谱数据解析失败，请刷新页面重试');
        }
      }

      function startEngine(data) {
        if (initComplete || !data) return;

        if (typeof d3 === 'undefined') {
          d3LoadAttempts++;
          if (d3LoadAttempts < MAX_D3_LOAD_ATTEMPTS) {
            setTimeout(function() { startEngine(data); }, 200);
            return;
          }
          showError('D3.js 核心库未能加载，请刷新页面重试');
          return;
        }
        console.log('[Graph] D3 loaded successfully, version:', d3.version);

        var width = window.innerWidth || document.documentElement.clientWidth;
        var height = window.innerHeight || document.documentElement.clientHeight;

        if (width <= 0 || height <= 0) {
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            setTimeout(function() { startEngine(data); }, 250);
            return;
          } else {
            console.warn('[Graph] Dimension detection timed out, using fallback 800x600');
            width = 800;
            height = 600;
          }
        }

        try {
          document.getElementById('loading').style.display = 'none';
          initComplete = true;
          console.log('[Graph] startEngine: data nodes=' + data.nodes.length + ', links=' + data.links.length);
          ${engineScript}
          console.log('[Graph] Calling initGraph...');
          initGraph(data);
          console.log('[Graph] initGraph completed.');
        } catch(err) {
          console.error('[Graph] Fatal error:', err);
          showError(err.message + ' (查看控制台了解详情)');
        }
      }

      // 直接通过 CDN 加载 d3，避免 ./d3.min.js 在 srcdoc iframe 中的路径失效
      function loadD3() {
        var script = document.createElement('script');
        script.src = 'https://d3js.org/d3.v7.min.js';
        script.onload = function() {
          console.log('[Graph] D3 loaded from CDN, starting bootstrap...');
          bootstrap();
        };
        script.onerror = function() {
          showError('D3.js CDN 加载失败，请检查网络连接');
        };
        document.head.appendChild(script);
      }


      // 先加载 D3，加载完成后再 bootstrap
      loadD3();
    })();
  <\/script>
</body>
</html>
  `;

  // 只转义属性分隔符 " → &quot;，避免破坏 srcdoc 的 HTML 属性值
  // 不要对 & 和 ' 做全局替换：&amp; 会污染 JS 代码中的 && 等运算符
  // &#39; 会污染 JS 字符串字面量；浏览器在解析 srcdoc 属性时已正确处理
  const safeSrcdoc = loaderInternalHtml.replace(/"/g, '&quot;');

  return `
    <style>
      .sws-graph-print { display: none; }
      .sws-graph-screen { display: block; }
      @media print {
        .sws-graph-print { display: block !important; }
        .sws-graph-screen, .sws-graph-screen-wrapper { display: none !important; }
      }
    </style>

    <div class="media-container knowledge-graph-container" contenteditable="false" style="width: 100%; text-align: center; margin: 2rem 0; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; background: #ffffff; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); position: relative;">

      <!-- 影子数据容器 -->
      <script type="text/plain" id="data-${graphUid}" style="display:none !important;">${b64Data}</script>

      <div style="padding: 16px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          本期技术知识图谱
        </h3>
        <div style="display: flex; align-items: center; gap: 10px;">
          <p class="sws-graph-screen" style="margin: 0; font-size: 11px; font-weight: 600; color: #64748b; background: #e2e8f0; padding: 4px 10px; border-radius: 20px;">
            动态沙盘 · 智能自愈架构
          </p>
          <button class="graph-expand-btn" onclick="if(typeof app!=='undefined')app.toggleGraphExpand(this)" style="background: rgba(0,85,150,0.1); border: 1px solid rgba(0,85,150,0.2); border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: bold; color: #005596; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; white-space: nowrap;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
            全屏查看
          </button>
        </div>
      </div>

      <div class="sws-graph-screen-wrapper sws-graph-screen" style="position: relative; background: #fff;">
        <iframe id="iframe-${graphUid}" allowfullscreen="true" allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-popups allow-modals" srcdoc="${safeSrcdoc}" style="width: 100%; height: 750px; border: none; display: block;" scrolling="no"></iframe>
      </div>

      <div class="sws-graph-print" style="display: none !important; padding: 2rem 0; background: #ffffff;">
        ${staticSvgHtml}
        <p style="color:#64748b; font-size:12px; margin-top:20px; margin-bottom:0; text-align: center;">* 本图谱由 AI 根据全文自动提取渲染</p>
      </div>

    </div>
    <p><br/></p>
  `;
}
