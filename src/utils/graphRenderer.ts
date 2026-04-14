import { KnowledgeGraphData } from '../../services/aiService';

export function generateGraphHtml(data: KnowledgeGraphData): string {
  // 【架构级安检门：清洗大模型幻觉产生的“幽灵连线”】
  // 确保所有连线的 source 和 target 都真实存在于 nodes 数组中
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
  data.nodes.forEach(node => {
    if (node.weight < minWeight) minWeight = node.weight;
    if (node.weight > maxWeight) maxWeight = node.weight;
  });

  const svgNodes = data.nodes.map((n, i) => {
    const angle = (i / data.nodes.length) * 2 * Math.PI;
    // 基于权重插值计算字体大小（9-14px）
    const fontSizeRange = 14 - 9;
    const weightRatio = maxWeight === minWeight ? 0.5 : (n.weight - minWeight) / (maxWeight - minWeight);
    const fontSize = 9 + weightRatio * fontSizeRange;
    return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), fontSize };
  });

  const linksHtml = data.links.map(link => {
    const source = svgNodes.find(n => n.id === link.source);
    const target = svgNodes.find(n => n.id === link.target);
    if (!source || !target) return '';
    return `
      <line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="#cbd5e1" stroke-width="${Math.min(link.strength, 3)}" opacity="0.3" />
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
        .drawer-section-title { font-size: 12px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin: 15px 0 10px 0; letter-spacing: 1px; }
        .relation-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px; font-size: 12px; border: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;}
        .relation-item:hover { background: #f1f5f9; }
        .rel-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #e0e7ff; color: #4f46e5; font-weight: bold; }
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
        function updateLinksVisibility() {
          data.links.forEach(link => {
            let source = data.nodes.find(n => n.id === link.source);
            let target = data.nodes.find(n => n.id === link.target);
            // 只有当线的两端节点都可见时，线才可见
            link.visible = source && target && source.visible && target.visible;
          });
        }

        function initNodes() {
          let minWeight = Infinity; let maxWeight = -Infinity;
          
          // 按权重从大到小排序，优先展示核心
          data.nodes.sort((a, b) => b.weight - a.weight);
          
          data.nodes.forEach((node, index) => {
            if (node.weight < minWeight) minWeight = node.weight;
            if (node.weight > maxWeight) maxWeight = node.weight;
            
            // 【核心策略：初始只显示 Top 6 权重的核心节点】
            node.visible = index < 6;
            
            node.y = height / 2 + (Math.random() - 0.5) * 200; 
            node.vx = 0; node.vy = 0;
            node.radius = 10 + (node.weight * 1.8); 
            node.color = colors[node.type]?.main || colors.default.main;
            node.typeTag = colors[node.type]?.tag || colors.default.tag;
            
            const fontSizeRange = 15 - 9;
            const weightRatio = maxWeight === minWeight ? 0.5 : (node.weight - minWeight) / (maxWeight - minWeight);
            node.fontSize = 9 + weightRatio * fontSizeRange;

            if (node.type === 'concept' || node.type === 'material') {
              node.targetX = width * 0.3; 
            } else if (node.type === 'process') {
              node.targetX = width * 0.5;
            } else {
              node.targetX = width * 0.7;
            }
            node.x = node.targetX + (Math.random() - 0.5) * 100;
          });
          
          updateLinksVisibility();
          
          // 渲染时按权重从小到大，确保大节点在最上层
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
          // 过滤可见节点和可见连线
          const visibleNodes = data.nodes.filter(n => n.visible);
          const visibleLinks = data.links.filter(l => l.visible);
          
          // 1. 斥力模拟
          for (let i = 0; i < visibleNodes.length; i++) {
            for (let j = i + 1; j < visibleNodes.length; j++) {
              let node1 = visibleNodes[i], node2 = visibleNodes[j];
              let dx = node2.x - node1.x, dy = node2.y - node1.y;
              let dist = Math.sqrt(dx * dx + dy * dy) || 1;
              
              if (dist < 600) {
                let force = REPULSION / (dist * dist);
                let fx = (dx / dist) * force, fy = (dy / dist) * force;
                node1.vx -= fx; node1.vy -= fy; node2.vx += fx; node2.vy += fy;
              }

              // 【核心修复：柔性防重叠碰撞，彻底消除抽搐】
              let minDistance = node1.radius + node2.radius + 45; 
              if (dist < minDistance && dist > 0) {
                let overlap = minDistance - dist;
                // 绝对禁止修改 node.x / node.y！改用施加相反的加速度 (vx/vy) 去温柔地推开
                let pushForce = overlap * 0.03; // 极其轻柔的排斥系数
                let nx = (dx / dist) * pushForce;
                let ny = (dy / dist) * pushForce;
                
                node1.vx -= nx; node1.vy -= ny;
                node2.vx += nx; node2.vy += ny;
              }
            }
          }

          // 2. 引力/弹簧模拟
          visibleLinks.forEach(link => {
            let source = data.nodes.find(n => n.id === link.source);
            let target = data.nodes.find(n => n.id === link.target);
            if (!source || !target) return;
            let dx = target.x - source.x, dy = target.y - source.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            let force = (dist - SPRING_LENGTH) * SPRING_K * Math.min(link.strength, 3);
            let fx = (dx / dist) * force, fy = (dy / dist) * force;
            source.vx += fx; source.vy += fy; target.vx -= fx; target.vy -= fy;
          });

          // 3. 【行业标准流向：紧凑型微重力 (Cohesive Drift)】
          visibleNodes.forEach(node => {
            // X轴：轻柔引导至左中右轨道，但不强制，允许弹簧把它们拉偏
            let dx = node.targetX - node.x;
            node.vx += dx * GRAVITY;
            
            // Y轴：【核心恢复】强力的向心聚拢力！防止节点上下散得太开，形成紧凑的图谱生态
            let dy = height / 2 - node.y;
            node.vy += dy * GRAVITY;
          });

          // 4. 更新位置与阻尼
          visibleNodes.forEach(node => {
            if (node !== draggedNode) {
              node.vx *= DAMPING; node.vy *= DAMPING; 
              node.x += node.vx * ALPHA; node.y += node.vy * ALPHA;
              
              // 边界防护 (Bounding Box)
              if (node.x < node.radius) node.x = node.radius;
              if (node.x > width - node.radius) node.x = width - node.radius;
              if (node.y < node.radius) node.y = node.radius;
              if (node.y > height - node.radius) node.y = height - node.radius;
            }
          });
        }

        function draw() {
          ctx.clearRect(0, 0, width, height);
          
          // 过滤可见节点和可见连线
          const visibleNodes = data.nodes.filter(n => n.visible);
          const visibleLinks = data.links.filter(l => l.visible);
          
          // 【架构升级：应用摄像机镜头矩阵】
          ctx.save();
          ctx.translate(cameraOffsetX, cameraOffsetY);
          ctx.scale(cameraScale, cameraScale);
          
          // --- 画连线 (引入多重边合并防重叠算法) ---
          
          // 1. 在视觉渲染前，将相同起点和终点的连线合并为一条物理线
          const visualLinksMap = {};
          // 【核心修复 1】必须遍历 visibleLinks，严禁渲染隐藏的连线！
          visibleLinks.forEach(link => {
            const key = [link.source, link.target].sort().join('||');
            if (!visualLinksMap[key]) {
              visualLinksMap[key] = { 
                source: link.source, target: link.target, strength: link.strength,
                relationships: new Set([link.relationship]) 
              };
            } else {
              visualLinksMap[key].relationships.add(link.relationship);
              if (link.strength > visualLinksMap[key].strength) visualLinksMap[key].strength = link.strength;
            }
          });
          
          const visualLinks = Object.values(visualLinksMap);

          // 2. 遍历合并后的线条进行绘制
          visualLinks.forEach(link => {
            let source = data.nodes.find(n => n.id === link.source);
            let target = data.nodes.find(n => n.id === link.target);
            if (!source || !target) return;
            
            let isHighlight = hoveredNode === source || hoveredNode === target || selectedNode === source || selectedNode === target;
            let isFaded = (hoveredNode || selectedNode) && !isHighlight;

            // 【视觉核武：动态寻航箭头 (Directed Arrow)】
            // 1. 计算两点之间的角度
            let angle = Math.atan2(target.y - source.y, target.x - source.x);
            
            // 2. 计算目标节点的动态半径边界（包含 hover 时的扩大圈）
            let isTargetHovered = hoveredNode === target || selectedNode === target;
            let targetRadius = target.radius + (isTargetHovered ? 8 : 4) + 2; 
            
            // 3. 计算箭头应该停留在的精确坐标（正好碰到目标球的边缘）
            let arrowX = target.x - Math.cos(angle) * targetRadius;
            let arrowY = target.y - Math.sin(angle) * targetRadius;
            
            // 4. 随着摄像机自适应缩放的箭头大小
            let arrowSize = 8 / cameraScale;

            // 5. 绘制主干连线
            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(arrowX, arrowY); // 线只画到箭头处，不穿透球体
            ctx.strokeStyle = isHighlight ? '#3b82f6' : '#cbd5e1'; 
            ctx.lineWidth = isHighlight ? 2 / cameraScale : 1 / cameraScale;
            ctx.globalAlpha = isFaded ? 0.05 : (isHighlight ? 0.8 : 0.4); 
            ctx.stroke();

            // 6. 绘制实心箭头头部
            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = isHighlight ? '#3b82f6' : '#cbd5e1';
            // 箭头透明度比连线稍微深一点，更显眼
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

          // --- 画节点 (引入 Z轴排序与纯白护城河) ---
          // 【核心修复 2】必须使用 visibleNodes 进行排序和渲染，严禁画出僵尸球！
          const sortedNodes = [...visibleNodes].sort((a, b) => (a.weight || 0) - (b.weight || 0));
          
          sortedNodes.forEach(node => {
            let isHovered = hoveredNode === node || selectedNode === node;
            let isConnected = (hoveredNode || selectedNode) ? data.links.some(l => (l.source === (hoveredNode || selectedNode).id && l.target === node.id) || (l.target === (hoveredNode || selectedNode).id && l.source === node.id)) : false;
            let isFaded = (hoveredNode || selectedNode) && !isHovered && !isConnected;

            // 【视觉暗示：判断是否有潜伏的子节点】
            const hasHiddenNeighbors = data.links.some(l => {
              const targetNode = data.nodes.find(n => n.id === l.target);
              const sourceNode = data.nodes.find(n => n.id === l.source);
              return (l.source === node.id && targetNode && !targetNode.visible) ||
                     (l.target === node.id && sourceNode && !sourceNode.visible);
            });

            if (hasHiddenNeighbors) {
              ctx.beginPath(); ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
              ctx.strokeStyle = node.color; ctx.lineWidth = 1.5 / cameraScale;
              ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
            }

            ctx.globalAlpha = isFaded ? 0.1 : 1;
            ctx.beginPath(); ctx.arc(node.x, node.y, node.radius + (isHovered ? 8 : 4), 0, Math.PI * 2); 
            ctx.fillStyle = node.color; ctx.globalAlpha = isHovered ? 0.3 : 0.1; ctx.fill();
            ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); 
            ctx.fillStyle = node.color; ctx.globalAlpha = isFaded ? 0.2 : 1; ctx.fill();
            ctx.lineWidth = 2 / cameraScale; ctx.strokeStyle = '#ffffff'; ctx.stroke();

            ctx.globalAlpha = 1;
            const fontSize = Math.round(node.fontSize);
            ctx.font = (isHovered ? "bold" : "normal") + " " + fontSize + "px sans-serif";
            ctx.fillStyle = isHovered ? "#0f172a" : "#1e293b";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.lineWidth = 5 / cameraScale; ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineJoin = 'round';
            ctx.strokeText(node.name, node.x, node.y + node.radius + 14);
            ctx.fillText(node.name, node.x, node.y + node.radius + 14);
          });
          
          ctx.restore();
          ctx.globalAlpha = 1;
        }

        function loop() { simulate(); draw(); requestAnimationFrame(loop); }

        // 【架构升级：镜头平移、缩放与抓取综合交互】
        canvas.addEventListener('mousedown', e => {
          let rect = canvas.getBoundingClientRect(); 
          let screenX = e.clientX - rect.left; 
          let screenY = e.clientY - rect.top;
          let worldPos = screenToWorld(screenX, screenY);
          
          // 【核心修复 3】禁止抓取不可见的幽灵节点
          draggedNode = data.nodes.find(n => n.visible && Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5);
          
          if(draggedNode) { 
            draggedNode.vx = 0; draggedNode.vy = 0; 
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
            }
            
            // 【核心修复 4】禁止高亮不可见的幽灵节点
            hoveredNode = data.nodes.find(n => n.visible && Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5);
            
            // 任务 2：重写鼠标悬停的 Tooltip 智能提示
            if (hoveredNode && hoveredNode.description) {
              // 探测当前悬停的节点是否有隐藏的子节点
              const hasHiddenNeighbors = data.links.some(l => {
                const targetNode = data.nodes.find(n => n.id === l.target);
                const sourceNode = data.nodes.find(n => n.id === l.source);
                return (l.source === hoveredNode.id && targetNode && !targetNode.visible) ||
                       (l.target === hoveredNode.id && sourceNode && !sourceNode.visible);
              });

              // 组装金色呼吸高亮提示
              let hintHtml = '';
              if (hasHiddenNeighbors) {
                hintHtml = '<div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.2); color:#fbbf24; font-weight:bold; font-size:11px; display:flex; align-items:center; gap:4px; animation: pulse 2s infinite;">' + 
                           '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>' +
                           '双击节点，下钻展开隐藏工艺</div>';
              }

              tooltip.style.opacity = 1; tooltip.style.transform = "translateY(0)";
              tooltip.style.left = (e.clientX + 20) + 'px'; tooltip.style.top = (e.clientY + 20) + 'px';
              // 将提示追加到原有的 description 下方
              tooltip.innerHTML = '<span class="tag" style="background:' + hoveredNode.color + '20; color:' + hoveredNode.color + '">' + hoveredNode.typeTag + '</span><br/><strong>' + hoveredNode.name + '</strong><br/><span style="color:#cbd5e1; font-size:11px;">' + hoveredNode.description + '</span>' + hintHtml;
            } else { 
              tooltip.style.opacity = 0; tooltip.style.transform = "translateY(5px)";
            }
          }
        });

        window.addEventListener('mouseup', () => {
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
        function updateZoomText() {
          document.getElementById('zoomReset').innerText = Math.round(cameraScale * 100) + '%';
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
          cameraScale = 1; cameraOffsetX = 0; cameraOffsetY = 0; updateZoomText();
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
          ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

          if (!hasInitialized) {
            initNodes(); // 在具备真实物理尺寸时才初始化坐标
            hasInitialized = true;
            loop();      // 唤醒物理引擎
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
        resizeObserver.observe(document.body);
        setTimeout(() => { resizeCanvas(); }, 100); // 仅触发尺寸检测，由 resizeCanvas 内部决定是否启动引擎

        // 【终极防御：心跳探针】
        // 针对 Chrome/Edge 在 iframe 父级从 display: none 切为 block 时可能发生的 ResizeObserver 死寂(哑火) bug
        // 我们注入一个极其轻量的守护进程：只要发现还没开始渲染，且屏幕具备了物理尺寸，就强行打火！
        setInterval(() => {
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
          document.getElementById('drawerTitle').innerText = node.name;
          document.getElementById('drawerDesc').innerText = node.description || '暂无详细描述';
          const tagEl = document.getElementById('drawerTag');
          tagEl.innerText = node.typeTag;
          tagEl.style.color = node.color;
          tagEl.style.background = node.color + '20';
          
          // 查找与之相连的上下文链路
          const linksHtml = data.links.filter(l => l.source === node.id || l.target === node.id).map(l => {
            const isSource = l.source === node.id;
            const otherNodeId = isSource ? l.target : l.source;
            const otherNode = data.nodes.find(n => n.id === otherNodeId);
            if(!otherNode) return '';
            const direction = isSource ? '→ 输出至' : '← 来源于';
            return '<div class="relation-item">' +
              '<span style="font-weight:bold; color:#334155;">' + otherNode.name + '</span>' +
              '<span class="rel-badge">' + direction + ': ' + l.relationship + '</span>' +
            '</div>';
          }).join('');
          
          document.getElementById('drawerLinks').innerHTML = linksHtml || '<div style="color:#94a3b8; font-size:12px; text-align:center; margin-top:20px;">暂无直接关联</div>';
          drawer.classList.add('open');
        }

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
          
          // 1. 获取所有与当前双击节点直接相连的邻居节点
          let neighbors = [];
          data.links.forEach(link => {
            if (link.source === hoveredNode.id) {
              let targetNode = data.nodes.find(n => n.id === link.target);
              if (targetNode) neighbors.push(targetNode);
            }
            if (link.target === hoveredNode.id) {
              let sourceNode = data.nodes.find(n => n.id === link.source);
              if (sourceNode) neighbors.push(sourceNode);
            }
          });

          // 2. 状态判定：只要有一个邻居是隐藏的，当前操作就是"展开"；如果全可见，就是"收起"
          const hasHidden = neighbors.some(n => !n.visible);

          if (hasHidden) {
            // ================= 展开逻辑 (Expand) =================
            let hasSpawned = false;
            neighbors.forEach(otherNode => {
              if (!otherNode.visible) {
                otherNode.visible = true;
                // 让子节点在父节点体内出生，然后被物理斥力炸开
                otherNode.x = hoveredNode.x + (Math.random() - 0.5) * 10;
                otherNode.y = hoveredNode.y + (Math.random() - 0.5) * 10;
                hasSpawned = true;
              }
            });
            
            if (hasSpawned) {
              updateLinksVisibility();
              hoveredNode.vx += (Math.random() - 0.5) * 5;
              hoveredNode.vy += (Math.random() - 0.5) * 5;
            }
          } else {
            // ================= 收起逻辑 (Collapse) =================
            let hasCollapsed = false;
            
            neighbors.forEach(otherNode => {
              // 算法核心：孤岛检测 (Orphan Detection)
              // 检查这个邻居节点，除了连接我们双击的 hoveredNode 之外，是否还连着其他【可见】的节点？
              let visibleConnections = 0;
              data.links.forEach(l => {
                if (l.source === otherNode.id || l.target === otherNode.id) {
                  let connectedId = l.source === otherNode.id ? l.target : l.source;
                  let connectedNode = data.nodes.find(n => n.id === connectedId);
                  if (connectedNode && connectedNode.visible) {
                    visibleConnections++;
                  }
                }
              });

              // 如果它连着的可见节点数 <= 1，说明它【只】连着当前双击的父节点，可以安全收缩。
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
            sorted.forEach((n, i) => n.visible = i < 6);
          }
          updateLinksVisibility();
        });
      };
  `;

  // ================= 3. 终极兼容性封装 (影子容器架构) =================
  // 使用函数顶部已计算好的 b64Data
  const graphUid = 'sws-graph-' + Math.random().toString(36).substr(2, 9);

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
      
      <div class="sws-graph-print" style="padding: 2rem 0; background: #ffffff;">
        ${staticSvgHtml}
        <p style="color:#64748b; font-size:12px; margin-top:20px; margin-bottom:0; text-align: center;">* 本图谱由 AI 根据全文自动提取渲染</p>
      </div>

    </div>
    <p><br/></p>
  `;
}
