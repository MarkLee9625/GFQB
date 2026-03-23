import { KnowledgeGraphData } from '../../services/aiService';

export function generateGraphHtml(data: KnowledgeGraphData): string {
  const encodedData = encodeURIComponent(JSON.stringify(data));

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

  // ================= 2. 动态 Canvas 引擎 HTML (专供屏幕浏览) =================
  const iframeHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
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
        .drawer-header { margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
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
      </style>
    </head>
    <body>
      <canvas id="graphCanvas"></canvas>
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
        <button id="zoomOut" class="zoom-btn" title="缩小">-</button>
        <button id="zoomReset" class="zoom-btn zoom-text" title="重置视图">100%</button>
        <button id="zoomIn" class="zoom-btn" title="放大">+</button>
      </div>
      <script>
        const data = JSON.parse(decodeURIComponent('${encodedData}'));
        const canvas = document.getElementById('graphCanvas');
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

        function resizeCanvas() {
          width = window.innerWidth || document.body.clientWidth || 800;
          height = window.innerHeight || document.body.clientHeight || 650;
          if(width === 0) width = 800; if(height === 0) height = 650;
          canvas.width = width * window.devicePixelRatio;
          canvas.height = height * window.devicePixelRatio;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
          draw();
        }

        function initNodes() {
          let minWeight = Infinity; let maxWeight = -Infinity;
          data.nodes.forEach(node => {
            if (node.weight < minWeight) minWeight = node.weight;
            if (node.weight > maxWeight) maxWeight = node.weight;
          });
          
          data.nodes.forEach(node => {
            node.y = height / 2 + (Math.random() - 0.5) * 200; // 初始Y轴也稍微聚拢
            node.vx = 0; node.vy = 0;
            node.radius = 10 + (node.weight * 1.8); 
            node.color = colors[node.type]?.main || colors.default.main;
            node.typeTag = colors[node.type]?.tag || colors.default.tag;
            
            const fontSizeRange = 15 - 9;
            const weightRatio = maxWeight === minWeight ? 0.5 : (node.weight - minWeight) / (maxWeight - minWeight);
            node.fontSize = 9 + weightRatio * fontSizeRange;

            // 【行业标准：柔性流水线轨道】不再分布在屏幕最边缘，而是往中心聚拢，形成紧凑的带状网络
            if (node.type === 'concept' || node.type === 'material') {
              node.targetX = width * 0.3;  // 左侧 30%
            } else if (node.type === 'process') {
              node.targetX = width * 0.5;  // 中间 50%
            } else {
              node.targetX = width * 0.7;  // 右侧 70%
            }
            // 初始点在中心附近，让它们通过弹簧自己拉开
            node.x = node.targetX + (Math.random() - 0.5) * 100;
          });
          
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
          // 1. 斥力模拟
          for (let i = 0; i < data.nodes.length; i++) {
            for (let j = i + 1; j < data.nodes.length; j++) {
              let node1 = data.nodes[i], node2 = data.nodes[j];
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
          data.links.forEach(link => {
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
          data.nodes.forEach(node => {
            // X轴：轻柔引导至左中右轨道，但不强制，允许弹簧把它们拉偏
            let dx = node.targetX - node.x;
            node.vx += dx * GRAVITY;
            
            // Y轴：【核心恢复】强力的向心聚拢力！防止节点上下散得太开，形成紧凑的图谱生态
            let dy = height / 2 - node.y;
            node.vy += dy * GRAVITY;
          });

          // 4. 更新位置与阻尼
          data.nodes.forEach(node => {
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
          
          // 【架构升级：应用摄像机镜头矩阵】
          ctx.save();
          ctx.translate(cameraOffsetX, cameraOffsetY);
          ctx.scale(cameraScale, cameraScale);
          
          // --- 画连线 (引入多重边合并防重叠算法) ---
          
          // 1. 在视觉渲染前，将相同起点和终点的连线合并为一条物理线
          const visualLinksMap = {};
          data.links.forEach(link => {
            // 使用 sort() 生成无向键值，将 A->B 和 B->A 强制映射到同一条物理连线
            const key = [link.source, link.target].sort().join('||');
            if (!visualLinksMap[key]) {
              visualLinksMap[key] = { 
                source: link.source, 
                target: link.target, 
                strength: link.strength,
                // 使用 Set 来去重，防止大模型生成两个一模一样的动词
                relationships: new Set([link.relationship]) 
              };
            } else {
              visualLinksMap[key].relationships.add(link.relationship);
              // 强度取最大值
              if (link.strength > visualLinksMap[key].strength) {
                visualLinksMap[key].strength = link.strength;
              }
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

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = isHighlight ? '#3b82f6' : '#cbd5e1'; 
            ctx.lineWidth = isHighlight ? 2 / cameraScale : 1 / cameraScale;
            ctx.globalAlpha = isFaded ? 0.05 : (isHighlight ? 0.8 : 0.4); 
            ctx.stroke();

            if (isHighlight) {
              ctx.font = "bold 11px sans-serif";
              ctx.fillStyle = "#3b82f6";
              ctx.textAlign = "center"; 
              ctx.textBaseline = "middle"; 
              ctx.globalAlpha = 1;
              
              // 【核心修复：将多个关系动词拼接显示】
              const combinedText = Array.from(link.relationships).join(' / ');
              
              // 如果文字太长，稍微加上一点白色背景遮罩，防止被底部的线切割
              const textX = (source.x + target.x) / 2;
              const textY = (source.y + target.y) / 2 - 6;
              
              ctx.lineWidth = 3 / cameraScale; 
              ctx.strokeStyle = "rgba(255,255,255,0.9)";
              ctx.lineJoin = 'round';
              ctx.strokeText(combinedText, textX, textY);
              ctx.fillText(combinedText, textX, textY);
            }
          });

          // --- 画节点 (引入 Z轴排序与纯白护城河) ---
          // 必须按权重从小到大重新排序绘制，确保核心工艺永远盖在最上层！
          const sortedNodes = [...data.nodes].sort((a, b) => (a.weight || 0) - (b.weight || 0));
          
          sortedNodes.forEach(node => {
            let isHovered = hoveredNode === node || selectedNode === node;
            let isConnected = (hoveredNode || selectedNode) ? data.links.some(l => (l.source === (hoveredNode || selectedNode).id && l.target === node.id) || (l.target === (hoveredNode || selectedNode).id && l.source === node.id)) : false;
            let isFaded = (hoveredNode || selectedNode) && !isHovered && !isConnected;

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
            
            // 【视觉核武：纯白防叠光晕 Text Halo】
            ctx.lineWidth = 5 / cameraScale; // 随着缩放自适应的光晕厚度
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineJoin = 'round';
            ctx.strokeText(node.name, node.x, node.y + node.radius + 14);
            ctx.fillText(node.name, node.x, node.y + node.radius + 14);
          });
          
          // 【架构升级：恢复画布原始状态】
          ctx.restore();
          ctx.globalAlpha = 1;
        }

        function loop() { simulate(); draw(); requestAnimationFrame(loop); }

        // 【架构升级：镜头平移、缩放与抓取综合交互】
        canvas.addEventListener('mousedown', e => {
          let rect = canvas.getBoundingClientRect(); 
          let screenX = e.clientX - rect.left; 
          let screenY = e.clientY - rect.top;
          
          // 转换为世界坐标，判断是否点中了节点
          let worldPos = screenToWorld(screenX, screenY);
          draggedNode = data.nodes.find(n => Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5);
          
          if(draggedNode) { 
            draggedNode.vx = 0; draggedNode.vy = 0; 
          } else {
            // 没点中节点，开启全景平移 (Pan)
            isPanning = true;
            startPanX = screenX - cameraOffsetX;
            startPanY = screenY - cameraOffsetY;
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
            
            hoveredNode = data.nodes.find(n => Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5);
            if (hoveredNode && hoveredNode.description) {
              tooltip.style.opacity = 1; 
              tooltip.style.transform = "translateY(0)";
              tooltip.style.left = (e.clientX + 20) + 'px'; tooltip.style.top = (e.clientY + 20) + 'px';
              tooltip.innerHTML = '<span class="tag" style="background:' + hoveredNode.color + '20; color:' + hoveredNode.color + '">' + hoveredNode.typeTag + '</span><br/><strong>' + hoveredNode.name + '</strong><br/><span style="color:#cbd5e1; font-size:11px;">' + hoveredNode.description + '</span>';
            } else { 
              tooltip.style.opacity = 0; 
              tooltip.style.transform = "translateY(5px)";
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
        
        const resizeObserver = new ResizeObserver(() => resizeCanvas());
        resizeObserver.observe(document.body);

        setTimeout(() => { resizeCanvas(); initNodes(); loop(); }, 100);

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
            // 通知外层壳子：“我要找这个词所在的段落”
            window.parent.postMessage({ type: 'GRAPH_SEARCH_KEYWORD', keyword: selectedNode.name }, '*');
            
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
      </script>
    </body>
    </html>
  `;

  const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(iframeHtml);

  return `
    <style>
      .sws-graph-print { display: none; }
      .sws-graph-screen { display: block; }
      
      /* 核心修复：全屏模式下的样式穿透与自适应 */
      .knowledge-graph-container:fullscreen {
        width: 100vw !important;
        height: 100vh !important;
        max-width: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        display: flex !important;
        flex-direction: column !important;
        background: #ffffff !important;
      }
      .knowledge-graph-container:-webkit-full-screen {
        width: 100vw !important;
        height: 100vh !important;
        max-width: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        display: flex !important;
        flex-direction: column !important;
        background: #ffffff !important;
      }
      .knowledge-graph-container:fullscreen .sws-graph-screen-wrapper {
        flex: 1 1 auto !important;
        height: 100% !important;
      }
      .knowledge-graph-container:-webkit-full-screen .sws-graph-screen-wrapper {
        flex: 1 1 auto !important;
        height: 100% !important;
      }
      .knowledge-graph-container:fullscreen iframe,
      .knowledge-graph-container:-webkit-full-screen iframe {
        height: 100% !important;
      }

      @media print {
        .sws-graph-print { display: block !important; }
        .sws-graph-screen, .sws-graph-screen-wrapper { display: none !important; }
      }
    </style>

    <div class="media-container knowledge-graph-container" contenteditable="false" style="width: 100%; text-align: center; margin: 2rem 0; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; background: #ffffff; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
      
      <div style="padding: 16px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          全局知识图谱
        </h3>
        
        <div class="sws-graph-screen" style="display: flex; align-items: center; gap: 12px;">
          <p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748b; background: #e2e8f0; padding: 4px 10px; border-radius: 20px;">
            动态沙盘 · 支持拖拽
          </p>
          <button 
            onclick="
              const container = this.closest('.knowledge-graph-container');
              const isFull = document.fullscreenElement || document.webkitFullscreenElement;
              if (!isFull) {
                if (container.requestFullscreen) container.requestFullscreen();
                else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
                this.querySelector('span').innerText = '退出全屏';
              } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                this.querySelector('span').innerText = '沉浸全屏';
              }
            "
            style="cursor: pointer; background: #ffffff; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: bold; color: #0f172a; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);"
            onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#94a3b8';"
            onmouseout="this.style.background='#ffffff'; this.style.borderColor='#cbd5e1';"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
            <span>沉浸全屏</span>
          </button>
        </div>
      </div>
      
      <div class="sws-graph-screen-wrapper sws-graph-screen" style="position: relative; background: radial-gradient(circle at center, #ffffff 0%, #f8fafc 100%);">
        <iframe src="${dataUri}" style="width: 100%; height: 750px; border: none; display: block;" scrolling="no" sandbox="allow-scripts"></iframe>
      </div>
      
      <div class="sws-graph-print" style="padding: 2rem 0; background: #ffffff;">
        ${staticSvgHtml}
        <p style="color:#64748b; font-size:12px; margin-top:20px; margin-bottom:0; text-align: center;">* 本图谱由 AI 引擎全自动提取渲染</p>
      </div>
    </div>
    <p><br/></p>
  `;
}