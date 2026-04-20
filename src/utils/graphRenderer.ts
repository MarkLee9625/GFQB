import { KnowledgeGraphData } from '../../services/aiService';

export function generateGraphHtml(data: KnowledgeGraphData): string {
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

  // 接下来才是原本的编码逻辑
  const b64Data = btoa(unescape(encodeURIComponent(JSON.stringify(data))));

  // ================= 1. 静态 SVG 引擎 (专供打印，优化了排版间距) =================
  const width = 800; const height = 800;
  const cx = width / 2; const cy = height / 2; const radius = 280;

  // 计算全局最大最小权重用于字体大小计算
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
    // 基于权重插值计算字体大小（9-14px）
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
      <line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="#cbd5e1" stroke-width="${Math.min(link.strength, 3)}" opacity="0.3" marker-end="url(#arrowhead)" />
    `;
  }).join('');

  const nodesHtml = svgNodes.map(node => {
    const colors: Record<string, string> = { technology: '#3b82f6', process: '#10b981', material: '#f59e0b', equipment: '#8b5cf6', concept: '#64748b' };
    const color = colors[node.type] || '#3b82f6';
    const r = 12 + (node.weight * 1.2);
    // 所有节点都显示文字，根据预计算的字体大小渲染
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

  const graphStyles = `
        body { margin: 0; overflow: hidden; background: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
        canvas { display: block; width: 100vw; height: 100vh; cursor: grab; }
        canvas:active { cursor: grabbing; }
        .tooltip {
          position: absolute; background: rgba(15, 23, 42, 0.95); color: #fff;
          padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.5;
          pointer-events: none; opacity: 0; transition: opacity 0.2s, transform 0.2s;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); max-width: 250px; z-index: 10;
          backdrop-filter: blur(4px);
        }
        .tooltip .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
        
        .legend-panel {
          position: absolute; top: 20px; right: 20px; z-index: 10;
          background: rgba(255,255,255,0.9); backdrop-filter: blur(4px);
          padding: 8px 14px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          border: 1px solid #e2e8f0; font-size: 12px; color: #475569;
          display: flex; gap: 12px; align-items: center;
        }
        .legend-item { display: flex; align-items: center; gap: 4px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        .search-box {
          position: absolute; top: 60px; right: 20px; z-index: 10;
          background: rgba(255,255,255,0.95); backdrop-filter: blur(4px);
          padding: 6px 10px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          border: 1px solid #e2e8f0;
        }
        .search-box input {
          border: none; outline: none; font-size: 12px; width: 160px;
          background: transparent; color: #334155;
        }
        .search-box input::placeholder { color: #94a3b8; }

        /* 呼吸动画 */
        @keyframes pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; text-shadow: 0 0 8px rgba(251, 191, 36, 0.5); }
          100% { opacity: 0.7; }
        }

        /* 情报溯源面板 (右侧抽屉) */
        .drawer {
          position: absolute; top: 0; right: -350px; width: 320px; height: 100vh;
          background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
          box-shadow: -5px 0 25px rgba(0,0,0,0.1); border-left: 1px solid #e2e8f0;
          transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex; flex-direction: column; z-index: 20; padding: 20px; box-sizing: border-box;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .drawer.open { right: 0; }
        .drawer-close { position: absolute; top: 15px; right: 15px; cursor: pointer; color: #64748b; font-size: 20px; font-weight: bold; border:none; background:none; }
        .drawer-close:hover { color: #0f172a; }
        .drawer-header { margin: 0 0 20px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
        .drawer-title { font-size: 20px; font-weight: 900; color: #0f172a; margin: 10px 0 5px 0; }
        .drawer-desc { font-size: 13px; color: #475569; line-height: 1.6; }
        .drawer-desc.line-clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; }
        .drawer-section-title { font-size: 12px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 15px 0 10px 0; letter-spacing: 1px; }
        .relation-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px; font-size: 12px; border: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;}
        .relation-item:hover { background: #f1f5f9; }
        .rel-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #e0e7ff; color: #4f46e5; font-weight: bold; }
        .rel-strength { display: inline-flex; gap: 2px; margin-left: 6px; align-items: center; }
        .rel-dot { width: 6px; height: 6px; border-radius: 50%; background: #64748b; }
        .rel-dot.active { background: #3b82f6; }
        .action-btn { margin-top: auto; width: 100%; padding: 12px; background: #0f172a; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; justify-content: center; gap: 8px; align-items: center; transition: background 0.2s;}
        .action-btn:hover { background: #1e293b; }

        /* 缩放与平移控制台 */
        .zoom-controls {
          position: absolute; bottom: 20px; left: 20px; z-index: 10;
          display: flex; gap: 8px; background: rgba(255,255,255,0.9);
          padding: 6px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          border: 1px solid #e2e8f0; backdrop-filter: blur(4px);
        }
        .zoom-btn {
          width: 32px; height: 32px; border: none; background: #f8fafc;
          border-radius: 6px; color: #475569; font-weight: bold; font-size: 16px;
          cursor: pointer; transition: all 0.2s; display: flex; justify-content: center; align-items: center;
        }
        .zoom-btn:hover { background: #e2e8f0; color: #0f172a; }
        .zoom-text { font-size: 12px; padding: 0 8px; width: auto; }
  `;
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
  const engineScript = `
    function initGraph(data) {
        const canvas = document.getElementById('graphCanvas');
        if (!canvas) {
          console.error('[Graph] Canvas element #graphCanvas not found');
          return;
        }
        const ctx = canvas.getContext('2d');
        const tooltip = document.getElementById('tooltip');
        
        let width = 800, height = 650;
        const colors = { 
          technology: { main: '#3b82f6', tag: '技术' }, 
          process: { main: '#10b981', tag: '工艺' }, 
          material: { main: '#f59e0b', tag: '材料' }, 
          equipment: { main: '#8b5cf6', tag: '设备' }, 
          concept: { main: '#64748b', tag: '理念' }, 
          default: { main: '#3b82f6', tag: '节点' } 
        };

        // 【架构升级：渐进式下钻状态管理】
        let isAllExpanded = false;
        let nodeMap = new Map();
        let adjacencyMap = new Map();
        let visibleNodesCache = [];
        let visibleLinksCache = [];
        let sortedNodesCache = [];
        let visualLinksCache = [];
        let visibilityDirty = true;
        let isSleeping = false;

        function markDirty() { visibilityDirty = true; isSleeping = false; }

        function updateLinksVisibility() {
          data.links.forEach(link => {
            let source = nodeMap.get(link.source);
            let target = nodeMap.get(link.target);
            link.visible = source && target && source.visible && target.visible;
          });
          markDirty();
        }

        function rebuildVisibilityCache() {
          if (!visibilityDirty) return;
          visibleNodesCache.length = 0;
          visibleLinksCache.length = 0;
          for (let i = 0; i < data.nodes.length; i++) {
            if (data.nodes[i].visible) visibleNodesCache.push(data.nodes[i]);
          }
          for (let i = 0; i < data.links.length; i++) {
            if (data.links[i].visible) visibleLinksCache.push(data.links[i]);
          }
          sortedNodesCache = [...visibleNodesCache].sort((a, b) => (a.weight || 0) - (b.weight || 0));

          const vlm = {};
          visibleLinksCache.forEach(link => {
            const key = link.source < link.target ? link.source + '||' + link.target : link.target + '||' + link.source;
            if (!vlm[key]) {
              vlm[key] = { source: link.source, target: link.target, _sourceNode: link._sourceNode, _targetNode: link._targetNode, strength: link.strength, relationships: new Set([link.relationship]) };
            } else {
              vlm[key].relationships.add(link.relationship);
              if (link.strength > vlm[key].strength) vlm[key].strength = link.strength;
            }
          });
          visualLinksCache = Object.values(vlm);
          if (visualLinksCache.length > MAX_VISIBLE_LINKS && !showAllLinks) {
            visualLinksCache.sort((a, b) => b.strength - a.strength);
            visualLinksCache = visualLinksCache.slice(0, MAX_VISIBLE_LINKS);
          }

          data.nodes.forEach(node => {
            const neighbors = adjacencyMap.get(node.id) || [];
            node._hasHiddenNeighbors = neighbors.some(nid => { const n = nodeMap.get(nid); return n && !n.visible; });
          });

          visibilityDirty = false;
        }

        function initNodes() {
          let minWeight = Infinity; let maxWeight = -Infinity;
          
          data.nodes.sort((a, b) => b.weight - a.weight);
          const topWeight = data.nodes[0]?.weight || 10;
          
          nodeMap.clear();
          adjacencyMap.clear();

          data.nodes.forEach((node, index) => {
            if (node.weight < minWeight) minWeight = node.weight;
            if (node.weight > maxWeight) maxWeight = node.weight;
            
            node.visible = index < 12;
            
            node.y = height / 2 + (Math.random() - 0.5) * 200; 
            node.vx = 0; node.vy = 0;
            node.radius = 8 + (node.weight * 2.2); 
            node.color = colors[node.type]?.main || colors.default.main;
            node.typeTag = colors[node.type]?.tag || colors.default.tag;
            
            const fontSizeRange = 15 - 9;
            const weightRatio = maxWeight === minWeight ? 0.5 : (node.weight - minWeight) / (maxWeight - minWeight);
            node.fontSize = 9 + weightRatio * fontSizeRange;
            node.roundedFontSize = Math.round(node.fontSize);

            if (node.type === 'concept' || node.type === 'material') {
              node.targetX = width * 0.25; 
            } else if (node.type === 'process') {
              node.targetX = width * 0.5;
            } else {
              node.targetX = width * 0.75;
            }

            const wRatio = topWeight > 1 ? (node.weight - 1) / (topWeight - 1) : 0.5;
            if (wRatio >= 0.7) {
              node.targetY = height * 0.5;
            } else if (wRatio >= 0.4) {
              node.targetY = height * (index % 2 === 0 ? 0.35 : 0.65);
            } else {
              node.targetY = height * (0.2 + (index * 0.03) % 0.6);
            }

            node.x = node.targetX + (Math.random() - 0.5) * 100;
            node.y = node.targetY + (Math.random() - 0.5) * 50;

            nodeMap.set(node.id, node);
            adjacencyMap.set(node.id, []);
          });

          data.links.forEach(link => {
            link._sourceNode = nodeMap.get(link.source);
            link._targetNode = nodeMap.get(link.target);
            if (link._sourceNode && link._targetNode) {
              adjacencyMap.get(link.source)?.push(link.target);
              adjacencyMap.get(link.target)?.push(link.source);
            }
          });
          
          updateLinksVisibility();
          
          data.nodes.sort((a, b) => a.weight - b.weight);
        }

        // 【抗抽搐物理引擎：柔性缓冲模式】
        const ALPHA = 0.1;          // 【核心】动能倍率从 0.3 降至 0.1，防止单帧步长过大
        const REPULSION = 6000;     // 适度增加底斥力，对抗高密连线
        const SPRING_LENGTH = 160;  // 【核心】弹簧长度必须略大于碰撞体积(约130)，从物理上解开死锁
        const SPRING_K = 0.015;     // 【核心】弹簧刚度大幅削弱！变成极其柔软的橡皮筋
        const DAMPING = 0.75;       // 【核心】增加空气阻力(摩擦力)，让震荡的节点快速安静下来
        const GRAVITY = 0.003;      // 轻微的中心向心力

        let draggedNode = null, hoveredNode = null, selectedNode = null, mouseX = 0, mouseY = 0;
        let destroyed = false;
        let heartbeatIntervalId = null;
        let resizeObserverRef = null;
        let searchKeyword = '';
        const MAX_VISIBLE_LINKS = 40;
        let showAllLinks = false;
        
        // 【架构升级：摄像机镜头系统 (Viewport)】
        let cameraScale = 1;
        let cameraOffsetX = 0;
        let cameraOffsetY = 0;
        let isPanning = false;
        let startPanX = 0;
        let startPanY = 0;

        // 坐标转换：屏幕坐标 -> 真实世界(画布)坐标
        function screenToWorld(x, y) {
          return {
            x: (x - cameraOffsetX) / cameraScale,
            y: (y - cameraOffsetY) / cameraScale
          };
        }

        function simulate() {
          rebuildVisibilityCache();
          
          for (let i = 0; i < visibleNodesCache.length; i++) {
            for (let j = i + 1; j < visibleNodesCache.length; j++) {
              let node1 = visibleNodesCache[i], node2 = visibleNodesCache[j];
              let dx = node2.x - node1.x, dy = node2.y - node1.y;
              let distSq = dx * dx + dy * dy;
              let dist = Math.sqrt(distSq) || 1;
              
              if (distSq < 360000) {
                let force = REPULSION / distSq;
                let fx = (dx / dist) * force, fy = (dy / dist) * force;
                node1.vx -= fx; node1.vy -= fy; node2.vx += fx; node2.vy += fy;
              }

              let minDistance = node1.radius + node2.radius + 45; 
              if (dist < minDistance && dist > 0) {
                let overlap = minDistance - dist;
                let pushForce = overlap * 0.03;
                let nx = (dx / dist) * pushForce;
                let ny = (dy / dist) * pushForce;
                
                node1.vx -= nx; node1.vy -= ny;
                node2.vx += nx; node2.vy += ny;
              }
            }
          }

          visibleLinksCache.forEach(link => {
            let source = link._sourceNode;
            let target = link._targetNode;
            if (!source || !target) return;
            let dx = target.x - source.x, dy = target.y - source.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let force = (dist - SPRING_LENGTH) * SPRING_K * Math.min(link.strength, 3);
            let fx = (dx / dist) * force, fy = (dy / dist) * force;
            source.vx += fx; source.vy += fy; target.vx -= fx; target.vy -= fy;
          });

          visibleNodesCache.forEach(node => {
            let dx = node.targetX - node.x;
            node.vx += dx * GRAVITY;
            
            let dy = (node.targetY !== undefined ? node.targetY : height / 2) - node.y;
            node.vy += dy * GRAVITY;
          });

          visibleNodesCache.forEach(node => {
            if (node !== draggedNode) {
              node.vx *= DAMPING; node.vy *= DAMPING; 
              node.x += node.vx * ALPHA; node.y += node.vy * ALPHA;
              
              if (node.x < node.radius) node.x = node.radius;
              if (node.x > width - node.radius) node.x = width - node.radius;
              if (node.y < node.radius) node.y = node.radius;
              if (node.y > height - node.radius) node.y = height - node.radius;
            }
          });
        }

        function draw() {
          ctx.clearRect(0, 0, width, height);
          
          ctx.save();
          ctx.translate(cameraOffsetX, cameraOffsetY);
          ctx.scale(cameraScale, cameraScale);

          ctx.globalAlpha = 0.035;
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(0, 0, width * 0.38, height);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(width * 0.38, 0, width * 0.24, height);
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(width * 0.62, 0, width * 0.38, height);
          ctx.globalAlpha = 1;

          // 连线绘制（独立 alpha 状态）
          ctx.save();
          visualLinksCache.forEach(link => {
            let source = link._sourceNode || nodeMap.get(link.source);
            let target = link._targetNode || nodeMap.get(link.target);
            if (!source || !target) return;
            
            let isHighlight = hoveredNode === source || hoveredNode === target || selectedNode === source || selectedNode === target;
            let isFaded = (hoveredNode || selectedNode) && !isHighlight;

            if (searchKeyword) {
              const sourceMatch = source.name.toLowerCase().includes(searchKeyword) || (source.description || '').toLowerCase().includes(searchKeyword);
              const targetMatch = target.name.toLowerCase().includes(searchKeyword) || (target.description || '').toLowerCase().includes(searchKeyword);
              if (!sourceMatch && !targetMatch) isFaded = true;
              else isFaded = false;
            }

            let angle = Math.atan2(target.y - source.y, target.x - source.x);
            let isTargetHovered = hoveredNode === target || selectedNode === target;
            let targetRadius = target.radius + (isTargetHovered ? 8 : 4) + 2; 
            let arrowX = target.x - Math.cos(angle) * targetRadius;
            let arrowY = target.y - Math.sin(angle) * targetRadius;
            let arrowSize = 8 / cameraScale;

            const dist = Math.sqrt((target.x - source.x) ** 2 + (target.y - source.y) ** 2);
            const relCount = link.relationships.size;
            const curvature = relCount > 1 ? 20 : 0;

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            if (curvature > 0 && dist > 0) {
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2;
              const perpX = -(target.y - source.y) / dist * curvature;
              const perpY = (target.x - source.x) / dist * curvature;
              ctx.quadraticCurveTo(midX + perpX, midY + perpY, arrowX, arrowY);
            } else {
              ctx.lineTo(arrowX, arrowY);
            }
            ctx.strokeStyle = isHighlight ? '#3b82f6' : '#cbd5e1'; 
            ctx.lineWidth = isHighlight ? 2 / cameraScale : 1 / cameraScale;
            ctx.globalAlpha = isFaded ? 0.05 : (isHighlight ? 0.8 : 0.4); 
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = isHighlight ? '#3b82f6' : '#cbd5e1';
            ctx.globalAlpha = isFaded ? 0.05 : (isHighlight ? 1 : 0.6); 
            ctx.fill();

            if (isHighlight) {
              ctx.font = "bold 11px sans-serif";
              ctx.fillStyle = "#3b82f6";
              ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = 1;
              const combinedText = Array.from(link.relationships).join(' / ');
              const textX = (source.x + target.x) / 2;
              const textY = (source.y + target.y) / 2 - 6;
              ctx.lineWidth = 3 / cameraScale; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineJoin = 'round';
              ctx.strokeText(combinedText, textX, textY);
              ctx.fillText(combinedText, textX, textY);
            }
          });
          ctx.restore(); // 连线 alpha 状态结束

          const focusNode = hoveredNode || selectedNode;
          const focusNeighbors = focusNode ? (adjacencyMap.get(focusNode.id) || []) : [];

          // 节点绘制（独立 alpha 状态）
          ctx.save();
          sortedNodesCache.forEach(node => {
            let isHovered = hoveredNode === node || selectedNode === node;
            let isConnected = focusNode ? focusNeighbors.includes(node.id) : false;
            let isFaded = focusNode && !isHovered && !isConnected;

            if (searchKeyword) {
              const match = node.name.toLowerCase().includes(searchKeyword) || (node.description || '').toLowerCase().includes(searchKeyword);
              if (!match) isFaded = true;
              else isFaded = false;
            }

            if (node._hasHiddenNeighbors) {
              ctx.beginPath(); ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
              ctx.strokeStyle = node.color; ctx.lineWidth = 1.5 / cameraScale;
              ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
            }

            if (node.weight >= 8 && !isFaded) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.radius + 14, 0, Math.PI * 2);
              const gradient = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 14);
              gradient.addColorStop(0, node.color + '30');
              gradient.addColorStop(1, node.color + '00');
              ctx.fillStyle = gradient;
              ctx.globalAlpha = 1;
              ctx.fill();
            }

            ctx.globalAlpha = isFaded ? 0.1 : 1;
            ctx.beginPath(); ctx.arc(node.x, node.y, node.radius + (isHovered ? 8 : 4), 0, Math.PI * 2); 
            ctx.fillStyle = node.color; ctx.globalAlpha = isHovered ? 0.3 : 0.1; ctx.fill();
            ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); 
            ctx.fillStyle = node.color; ctx.globalAlpha = isFaded ? 0.2 : 1; ctx.fill();
            ctx.lineWidth = 2 / cameraScale; ctx.strokeStyle = '#ffffff'; ctx.stroke();

            const showLabel = cameraScale > 0.5 || node.weight >= 7 || isHovered;
            if (showLabel) {
            ctx.globalAlpha = 1;
            ctx.font = (isHovered ? "bold" : "normal") + " " + node.roundedFontSize + "px sans-serif";
            ctx.fillStyle = isHovered ? "#0f172a" : "#1e293b";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.lineWidth = 5 / cameraScale; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineJoin = 'round';
            
            var maxTextWidth = 140;
            var displayName = node.name;
            if (ctx.measureText(displayName).width > maxTextWidth) {
              while (ctx.measureText(displayName + '\u2026').width > maxTextWidth && displayName.length > 1) {
                displayName = displayName.slice(0, -1);
              }
              displayName += '\u2026';
            }
            ctx.strokeText(displayName, node.x, node.y + node.radius + 14);
            ctx.fillText(displayName, node.x, node.y + node.radius + 14);
            }
          });
          
          ctx.restore(); // 节点 alpha 状态结束
          ctx.restore(); // 相机变换结束
        }

        function loop() {
          if (destroyed) return;
          if (isSleeping) {
            requestAnimationFrame(loop);
            return;
          }
          simulate();
          draw();
          let totalEnergy = 0;
          for (let i = 0; i < visibleNodesCache.length; i++) {
            totalEnergy += Math.abs(visibleNodesCache[i].vx) + Math.abs(visibleNodesCache[i].vy);
          }
          if (totalEnergy < 0.01 && !draggedNode) {
            isSleeping = true;
          }
          requestAnimationFrame(loop);
        }

        // 【架构升级：镜头平移、缩放与抓取综合交互】
        let lastTooltipNodeId = null;
        let lastTooltipX = 0, lastTooltipY = 0;

        canvas.addEventListener('mousedown', e => {
          let rect = canvas.getBoundingClientRect(); 
          let screenX = e.clientX - rect.left; 
          let screenY = e.clientY - rect.top;
          let worldPos = screenToWorld(screenX, screenY);
          
          draggedNode = null;
          for (let i = visibleNodesCache.length - 1; i >= 0; i--) {
            const n = visibleNodesCache[i];
            if (Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5) {
              draggedNode = n;
              break;
            }
          }
          
          if(draggedNode) { 
            draggedNode.vx = 0; draggedNode.vy = 0; 
            isSleeping = false;
          } else {
            isPanning = true; startPanX = screenX - cameraOffsetX; startPanY = screenY - cameraOffsetY;
            canvas.style.cursor = 'grabbing';
          }
        });

        canvas.addEventListener('mousemove', e => {
          let rect = canvas.getBoundingClientRect(); 
          mouseX = e.clientX - rect.left; 
          mouseY = e.clientY - rect.top;

          if (isPanning) {
            cameraOffsetX = mouseX - startPanX;
            cameraOffsetY = mouseY - startPanY;
          } else {
            let worldPos = screenToWorld(mouseX, mouseY);
            if (draggedNode) { 
              draggedNode.x = worldPos.x; 
              draggedNode.y = worldPos.y; 
              isSleeping = false;
            }
            
            hoveredNode = null;
            for (let i = visibleNodesCache.length - 1; i >= 0; i--) {
              const n = visibleNodesCache[i];
              if (Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5) {
                hoveredNode = n;
                break;
              }
            }
            
            if (hoveredNode && hoveredNode.description) {
              if (hoveredNode.id !== lastTooltipNodeId) {
                lastTooltipNodeId = hoveredNode.id;
                const hasHidden = hoveredNode._hasHiddenNeighbors;
                const neighborCount = (adjacencyMap.get(hoveredNode.id) || []).length;
                const statsLine = '<div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.15); color:#94a3b8; font-size:11px;">权重: ' + hoveredNode.weight + '/10 | 关联: ' + neighborCount + ' 个节点</div>';
                let hintHtml = '';
                if (hasHidden) {
                  hintHtml = '<div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.2); color:#fbbf24; font-weight:bold; font-size:11px; display:flex; align-items:center; gap:4px; animation: pulse 2s infinite;">' + 
                             '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>' +
                             '双击节点，下钻展开隐藏工艺</div>';
                }
                tooltip.innerHTML = '<span class="tag" style="background:' + hoveredNode.color + '20; color:' + hoveredNode.color + '">' + hoveredNode.typeTag + '</span><br/><strong>' + hoveredNode.name + '</strong><br/><span style="color:#cbd5e1; font-size:11px;">' + hoveredNode.description + '</span>' + statsLine + hintHtml;
                tooltip.style.opacity = 1; tooltip.style.transform = "translateY(0)";
              }
              let ttLeft = e.clientX + 20;
              let ttTop = e.clientY + 20;
              const ttWidth = tooltip.offsetWidth || 280;
              const ttHeight = tooltip.offsetHeight || 150;
              if (ttLeft + ttWidth > window.innerWidth) ttLeft = e.clientX - ttWidth - 10;
              if (ttTop + ttHeight > window.innerHeight) ttTop = e.clientY - ttHeight - 10;
              tooltip.style.left = ttLeft + 'px'; tooltip.style.top = ttTop + 'px';
            } else { 
              tooltip.style.opacity = 0; tooltip.style.transform = "translateY(5px)";
              lastTooltipNodeId = null;
            }
          }
        });

        window.addEventListener('mouseup', () => {
          if (draggedNode) {
            draggedNode.vx += (Math.random() - 0.5) * 2;
            draggedNode.vy += (Math.random() - 0.5) * 2;
          }
          draggedNode = null;
          isPanning = false;
          canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('mouseleave', () => {
          draggedNode = null;
          isPanning = false;
          canvas.style.cursor = 'grab';
        });

        // 鼠标滚轮无极缩放 (向鼠标指针中心缩放)
        canvas.addEventListener('wheel', e => {
          e.preventDefault();
          isSleeping = false;
          const zoomSensitivity = 0.001;
          const delta = -e.deltaY * zoomSensitivity;
          let newScale = cameraScale * (1 + delta);
          
          // 限制缩放级别 (10% 到 500%)
          newScale = Math.max(0.1, Math.min(newScale, 5)); 

          let rect = canvas.getBoundingClientRect();
          let sX = e.clientX - rect.left;
          let sY = e.clientY - rect.top;

          // 核心代数矩阵补偿：保证缩放时，鼠标当前指着的节点不乱跑
          cameraOffsetX = sX - (sX - cameraOffsetX) * (newScale / cameraScale);
          cameraOffsetY = sY - (sY - cameraOffsetY) * (newScale / cameraScale);
          cameraScale = newScale;
          
          updateZoomText();
        }, { passive: false });

        // 左下角面板按钮控制
        const zoomResetBtn = document.getElementById('zoomReset');
        const drawerTitleEl = document.getElementById('drawerTitle');
        const drawerDescEl = document.getElementById('drawerDesc');
        const drawerTagEl = document.getElementById('drawerTag');
        const drawerLinksEl = document.getElementById('drawerLinks');

        function updateZoomText() {
          if (zoomResetBtn) zoomResetBtn.innerText = Math.round(cameraScale * 100) + '%';
        }

        document.getElementById('zoomIn').addEventListener('click', () => {
          let newScale = Math.min(cameraScale * 1.2, 5);
          cameraOffsetX = width/2 - (width/2 - cameraOffsetX) * (newScale / cameraScale);
          cameraOffsetY = height/2 - (height/2 - cameraOffsetY) * (newScale / cameraScale);
          cameraScale = newScale; updateZoomText();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
          let newScale = Math.max(cameraScale / 1.2, 0.1);
          cameraOffsetX = width/2 - (width/2 - cameraOffsetX) * (newScale / cameraScale);
          cameraOffsetY = height/2 - (height/2 - cameraOffsetY) * (newScale / cameraScale);
          cameraScale = newScale; updateZoomText();
        });

        document.getElementById('zoomReset').addEventListener('click', () => {
          cameraScale = 1; cameraOffsetX = 0; cameraOffsetY = 0; isSleeping = false; updateZoomText();
        });

        // 【架构师重构：延迟渲染与响应式引力重算】
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(err => console.warn('[Graph] 全屏请求被拦截:', err));
            } else {
              document.exitFullscreen();
            }
          });
          document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
               fullscreenBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
               fullscreenBtn.title = "退出全屏";
            } else {
               fullscreenBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
               fullscreenBtn.title = "全屏";
            }
          });
        }

        let hasInitialized = false;

        function resizeCanvas() {
          const container = document.body;
          const newWidth = container.clientWidth;
          const newHeight = container.clientHeight;
          
          // 核心拦截：如果处于 display: none 的隐藏状态，直接拒绝渲染并挂起
          if (newWidth === 0 || newHeight === 0) return; 
          
          width = newWidth;
          height = newHeight;
          canvas.width = width * window.devicePixelRatio || 1;
          canvas.height = height * window.devicePixelRatio || 1;
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

          if (!hasInitialized) {
            initNodes();
            hasInitialized = true;
            loop();
            if (heartbeatIntervalId) { clearInterval(heartbeatIntervalId); heartbeatIntervalId = null; }
          } else {
            // 响应式重算：如果窗口发生变化，动态更新引力点防止节点跑偏
            data.nodes.forEach(node => {
              if (node.type === 'concept' || node.type === 'material') {
                node.targetX = width * 0.3; 
              } else if (node.type === 'process') {
                node.targetX = width * 0.5;
              } else {
                node.targetX = width * 0.7;
              }
            });
          }
        }

        const resizeObserver = new ResizeObserver(() => resizeCanvas());
        resizeObserverRef = resizeObserver;
        resizeObserver.observe(document.body);
        setTimeout(() => { resizeCanvas(); }, 100); // 仅触发尺寸检测，由 resizeCanvas 内部决定是否启动引擎

        // 【终极防御：心跳探针】
        // 针对 Chrome/Edge 在 iframe 父级从 display: none 切为 block 时可能发生的 ResizeObserver 死寂(哑火) bug
        // 我们注入一个极其轻量的守护进程：只要发现还没开始渲染，且屏幕具备了物理尺寸，就强行打火！
        heartbeatIntervalId = setInterval(() => {
          if (!hasInitialized && document.body.clientWidth > 0 && document.body.clientHeight > 0) {
            console.log('[SWS Graph] 守护进程被激活：发现隐身恢复，强行引燃物理沙盘引擎...');
            resizeCanvas();
          }
        }, 250);

        // 【架构升级：情报溯源面板逻辑】
        const drawer = document.getElementById('drawer');
        const closeDrawer = document.getElementById('closeDrawer');

        // 修改全局变量，增加一个点击选中态
        // (在原本的 mousemove 逻辑里，将 isHovered 相关的判定同时兼顾 selectedNode)

        canvas.addEventListener('click', e => {
          if (draggedNode) return; // 如果在拖拽就不触发点击
          if (hoveredNode) {
            selectedNode = hoveredNode;
            openDrawer(selectedNode);
          } else {
            selectedNode = null;
            drawer.classList.remove('open');
          }
        });

        closeDrawer.addEventListener('click', () => {
          selectedNode = null;
          drawer.classList.remove('open');
        });

        function openDrawer(node) {
          if (drawerTitleEl) drawerTitleEl.innerText = node.name;
          if (drawerDescEl) {
            drawerDescEl.innerText = node.description || '暂无详细描述';
            drawerDescEl.classList.add('line-clamp');
          }
          if (drawerTagEl) {
            drawerTagEl.innerText = node.typeTag;
            drawerTagEl.style.color = node.color;
            drawerTagEl.style.background = node.color + '20';
          }
          
          const neighbors = adjacencyMap.get(node.id) || [];
          const linksHtml = data.links.filter(l => l.source === node.id || l.target === node.id).map(l => {
            const isSource = l.source === node.id;
            const otherNodeId = isSource ? l.target : l.source;
            const otherNode = nodeMap.get(otherNodeId);
            if(!otherNode) return '';
            const direction = isSource ? '→ 输出至' : '← 来源于';
            const strength = l.strength || 1;
            const dots = [1,2,3,4,5].map(i => '<span class="rel-dot' + (i <= strength ? ' active' : '') + '"></span>').join('');
            return '<div class="relation-item">' +
              '<span style="font-weight:bold; color:#334155;">' + otherNode.name + '</span>' +
              '<span class="rel-badge">' + direction + ': ' + l.relationship + '</span>' +
              '<span class="rel-strength">' + dots + '</span>' +
            '</div>';
          }).join('');
          
          if (drawerLinksEl) drawerLinksEl.innerHTML = linksHtml || '<div style="color:#94a3b8; font-size:12px; text-align:center; margin-top:20px;">暂无直接关联</div>';
          drawer.classList.add('open');
        }

        drawerLinksEl.addEventListener('click', (e) => {
          const item = e.target.closest('.relation-item');
          if (item && selectedNode) {
            const otherName = item.querySelector('span[style*="font-weight"]')?.textContent?.trim();
            const target = data.nodes.find(n => n.name === otherName);
            if (target) openDrawer(target);
          }
        });

        document.getElementById('searchInput').addEventListener('input', (e) => {
          searchKeyword = (e.target.value || '').trim().toLowerCase();
          isSleeping = false;
        });

        // 离线溯源通信：点击搜索按钮，向外层阅读器发送 postMessage
        document.getElementById('traceBtn').addEventListener('click', () => {
          if (selectedNode) {
            // 通知外层壳子："我要找这个词所在的段落"
            // 【安全修复】在 file:// 协议下，跨帧通信可能会抛出 Unsafe attempt to load URL 异常
            // 使用 try-catch 拦截异常，确保即便在离线文件环境下通信被阻断，图谱自身的高级交互逻辑（如下钻、折叠）不会因此崩溃。
            try {
              window.parent.postMessage({ type: 'GRAPH_SEARCH_KEYWORD', keyword: selectedNode.name }, '*');
            } catch (e) {
              console.warn('[安全拦截] 离线阅读器环境下，跨帧通信受限，已拦截异常保证图谱交互正常。', e);
            }
            
            // 为了视觉反馈，按钮可以变一下状态
            const btn = document.getElementById('traceBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '已触发页面检索...';
            btn.style.background = '#10b981';
            setTimeout(() => {
              btn.innerHTML = originalText;
              btn.style.background = '#0f172a';
            }, 2000);
          }
        });

        // 任务 4：部署智能双向折叠（Expand & Collapse）引擎
        // 【交互核武：双向细胞分裂与黑洞收缩】
        canvas.addEventListener('dblclick', e => {
          if (!hoveredNode) return;
          
          let neighbors = [];
          const neighborIds = adjacencyMap.get(hoveredNode.id) || [];
          neighborIds.forEach(nid => {
            const n = nodeMap.get(nid);
            if (n) neighbors.push(n);
          });

          const hasHidden = neighbors.some(n => !n.visible);

          if (hasHidden) {
            let hasSpawned = false;
            const hiddenNeighbors = neighbors.filter(n => !n.visible);
            const spawnRadius = 80;
            hiddenNeighbors.forEach((otherNode, i) => {
              const angle = (i / hiddenNeighbors.length) * 2 * Math.PI;
              otherNode.x = hoveredNode.x + Math.cos(angle) * spawnRadius;
              otherNode.y = hoveredNode.y + Math.sin(angle) * spawnRadius;
              otherNode.visible = true;
              hasSpawned = true;
            });
            
            if (hasSpawned) {
              updateLinksVisibility();
              hoveredNode.vx += (Math.random() - 0.5) * 5;
              hoveredNode.vy += (Math.random() - 0.5) * 5;
            }
          } else {
            let hasCollapsed = false;
            
            neighbors.forEach(otherNode => {
              let visibleConnections = 0;
              const otherNeighborIds = adjacencyMap.get(otherNode.id) || [];
              otherNeighborIds.forEach(connectedId => {
                const connectedNode = nodeMap.get(connectedId);
                if (connectedNode && connectedNode.visible) {
                  visibleConnections++;
                }
              });

              if (visibleConnections <= 1) {
                otherNode.visible = false;
                hasCollapsed = true;
              }
            });

            if (hasCollapsed) {
              updateLinksVisibility();
            }
          }
        });

        // 一键展开/收起按钮
        document.getElementById('toggleExpand').addEventListener('click', (e) => {
          isAllExpanded = !isAllExpanded;
          e.target.innerText = isAllExpanded ? "重置收起" : "展开全部";

        document.getElementById('toggleLinks').addEventListener('click', (e) => {
          showAllLinks = !showAllLinks;
          e.target.innerText = showAllLinks ? "全部链路" : "核心链路";
          markDirty();
        });
          
          if (isAllExpanded) {
            data.nodes.forEach(n => {
              if(!n.visible) {
                n.visible = true;
                n.x = width / 2 + (Math.random() - 0.5) * 50;
                n.y = height / 2 + (Math.random() - 0.5) * 50;
              }
            });
          } else {
            // 收起：重新走一遍初始化逻辑
            let sorted = [...data.nodes].sort((a, b) => b.weight - a.weight);
            sorted.forEach((n, i) => {
              n.visible = i < 12;
              if (n.visible) {
                if (n.type === 'concept' || n.type === 'material') n.targetX = width * 0.3;
                else if (n.type === 'process') n.targetX = width * 0.5;
                else n.targetX = width * 0.7;
                n.x = n.targetX + (Math.random() - 0.5) * 100;
                n.y = height / 2 + (Math.random() - 0.5) * 200;
              }
            });
          }
          updateLinksVisibility();
        });

        window.addEventListener('beforeunload', () => {
          destroyed = true;
          if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
          if (resizeObserverRef) resizeObserverRef.disconnect();
        });
      };
  `;

  // ================= 3. 终极兼容性封装 (影子容器架构) =================
  // 使用函数顶部已计算好的 b64Data
  const graphUid = 'sws-graph-' + Math.random().toString(36).substring(2, 11);

  // Iframe 内部渲染引擎脚本 (完全剥离数据后的纯 Loader)
  const loaderInternalHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#fff; font-family: sans-serif; }
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
      var retryCount = 0;
      var MAX_RETRIES = 40; // 约 10 秒 (250ms * 40)

      function showError(msg) {
        var el = document.getElementById('loading');
        if (el) {
          el.innerHTML = '图谱引擎启动失败<div class="error-msg">' + msg + '</div>';
          el.style.color = '#ef4444';
        }
      }

      // 【核心自解碼】
      function safeDecode(b64) {
        try {
          return JSON.parse(decodeURIComponent(escape(atob(b64))));
        } catch(e) {
          console.error('[Graph] Decode error:', e);
          return null;
        }
      }

      // 【核心自举：溯源父容器中的影子数据】
      function bootstrap() {
        try {
          // 优先尝试直接访问父级 DOM (针对同一 host 的渲染器)
          var dataEl = window.parent.document.getElementById('data-' + graphUid);
          if (dataEl) {
            var rawData = dataEl.textContent || dataEl.innerText;
            var data = safeDecode(rawData);
            if (data) {
              console.log('[Graph] Data found in parent DOM, starting engine...');
              return startEngine(data);
            }
          }
          console.warn('[Graph] Data element not found in parent DOM, fallback to postMessage...');
          throw new Error('Waiting for data...');
        } catch(e) {
          // 如果受限于 Sandbox (如禁止 parent 访问)，则发送请求信号
          window.parent.postMessage({ type: 'GRAPH_REQUEST_DATA', uid: graphUid }, '*');
          
          // 兜底：如果是 10 秒后还没收到数据，提示失败
          setTimeout(function() {
            if (!initComplete) {
              showError('数据初始化超时，请确保浏览器未禁用脚本');
            }
          }, 10000);
        }
      }

      function startEngine(data) {
        if (initComplete || !data) return;
        
        // 优先使用 window.innerWidth，如果为 0 则尝试 documentElement
        var width = window.innerWidth || document.documentElement.clientWidth;
        var height = window.innerHeight || document.documentElement.clientHeight;

        // 【抗灾心跳】解决 display: none 导致的宽高 0 挂起问题
        if (width <= 0 || height <= 0) {
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            setTimeout(function() { startEngine(data); }, 250);
            return;
          } else {
            console.warn('[Graph] Dimension detection timed out, using fallback 800x600');
            width = 800;
            height = 600;
            // 继续执行，不再 return
          }
        }

        try {
          document.getElementById('loading').style.display = 'none';
          initComplete = true;
          ${engineScript}
          initGraph(data); 
        } catch(err) {
          showError(err.message);
        }
      }

      // 监听来自父级的推送数据
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'GRAPH_DATA_RESPONSE' && event.data.uid === graphUid) {
          console.log('[Graph] Received data from postMessage, UID: ' + graphUid);
          if (event.data.data) startEngine(event.data.data);
          else if (event.data.dataB64) startEngine(safeDecode(event.data.dataB64));
        }
      });

      // 启动引导
      if (document.readyState === 'complete') bootstrap();
      else window.onload = bootstrap;
    })();
  <\/script>
</body>
</html>
  `;

  // Loader 本身也通过转义进入 srcdoc，但体积已经缩小了 90%
  // 【修复】srcdoc 的属性转义不能包含 < 和 >，否则浏览器无法解析为 HTML
  const safeSrcdoc = loaderInternalHtml
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
      
      <!-- 影子数据容器：承载海量图谱数据 (Base64) -->
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
        <iframe id="iframe-${graphUid}" allowfullscreen="true" sandbox="allow-scripts allow-same-origin allow-popups" srcdoc="${safeSrcdoc}" style="width: 100%; height: 750px; border: none; display: block;" scrolling="no"></iframe>
      </div>
      
      <div class="sws-graph-print" style="display: none !important; padding: 2rem 0; background: #ffffff;">
        ${staticSvgHtml}
        <p style="color:#64748b; font-size:12px; margin-top:20px; margin-bottom:0; text-align: center;">* 本图谱由 AI 根据全文自动提取渲染</p>
      </div>

    </div>
    <p><br/></p>
  `;
}
