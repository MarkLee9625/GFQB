import { KnowledgeGraphData } from '../../services/aiService';

export function generateGraphHtml(data: KnowledgeGraphData): string {
  const encodedData = encodeURIComponent(JSON.stringify(data));

  // ================= 1. 静态 SVG 引擎 (专供打印，优化了排版间距) =================
  const width = 800; const height = 800;
  const cx = width / 2; const cy = height / 2; const radius = 280;

  const svgNodes = data.nodes.map((n, i) => {
    const angle = (i / data.nodes.length) * 2 * Math.PI;
    return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
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
    // 静态版也只显示权重大于 6 的节点名字，避免重叠
    const showText = node.weight >= 6;
    return `
      <g transform="translate(${node.x}, ${node.y})">
        <circle r="${r + 4}" fill="${color}" opacity="0.15" />
        <circle r="${r}" fill="${color}" />
        ${showText ? `<text y="${r + 14}" text-anchor="middle" fill="#334155" font-size="11" font-weight="bold">${node.name}</text>` : ''}
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
      </style>
    </head>
    <body>
      <canvas id="graphCanvas"></canvas>
      <div id="tooltip" class="tooltip"></div>
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
          data.nodes.forEach(node => {
            node.x = width / 2 + (Math.random() - 0.5) * 400; // 初始散开范围更大
            node.y = height / 2 + (Math.random() - 0.5) * 400;
            node.vx = 0; node.vy = 0;
            node.radius = 10 + (node.weight * 1.8); // 稍微放大核心节点视觉差异
            node.color = colors[node.type]?.main || colors.default.main;
            node.typeTag = colors[node.type]?.tag || colors.default.tag;
          });
        }

        // 【核心修改1：调整物理引擎参数，打破黑洞】
        const ALPHA = 0.25;         // 冷却系数
        const REPULSION = 3500;     // 斥力大幅增强 (原1500 -> 3500)
        const SPRING_LENGTH = 180;  // 连线弹簧变长 (原150 -> 180)
        const SPRING_K = 0.03;      // 弹簧刚度调弱，允许拉伸
        const DAMPING = 0.85;       // 摩擦力
        const GRAVITY = 0.003;      // 向心力大幅减弱 (原0.02 -> 0.003)，让节点自由散开

        let draggedNode = null, hoveredNode = null, mouseX = 0, mouseY = 0;

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

              // 【核心修改2：刚体碰撞检测 (Anti-Overlap)】
              // 如果两个节点靠得太近，强制把它们弹开，绝对不许重叠
              let minDistance = node1.radius + node2.radius + 20; // 20是最小间距
              if (dist < minDistance) {
                let overlap = minDistance - dist;
                let nx = (dx / dist) * overlap * 0.5;
                let ny = (dy / dist) * overlap * 0.5;
                node1.x -= nx; node1.y -= ny;
                node2.x += nx; node2.y += ny;
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

          // 3. 微弱向心力 (防止节点飞出屏幕)
          data.nodes.forEach(node => {
            node.vx += (width / 2 - node.x) * GRAVITY; 
            node.vy += (height / 2 - node.y) * GRAVITY;
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
          
          // 画连线
          data.links.forEach(link => {
            let source = data.nodes.find(n => n.id === link.source);
            let target = data.nodes.find(n => n.id === link.target);
            if (!source || !target) return;
            let isHighlight = hoveredNode === source || hoveredNode === target;
            let isFaded = hoveredNode && !isHighlight;

            ctx.beginPath(); ctx.moveTo(source.x, source.y); ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = isHighlight ? '#3b82f6' : '#cbd5e1'; 
            ctx.lineWidth = isHighlight ? 2 : 1;
            ctx.globalAlpha = isFaded ? 0.1 : (isHighlight ? 0.8 : 0.4); 
            ctx.stroke();

            // 只有高亮时才显示连线文字，减少满屏文字的干扰
            if (isHighlight) {
              ctx.font = "bold 11px sans-serif";
              ctx.fillStyle = "#3b82f6";
              ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.globalAlpha = 1;
              ctx.fillText(link.relationship, (source.x + target.x) / 2, (source.y + target.y) / 2 - 6);
            }
          });

          // 画节点
          data.nodes.forEach(node => {
            let isHovered = hoveredNode === node;
            let isConnected = hoveredNode ? data.links.some(l => (l.source === hoveredNode.id && l.target === node.id) || (l.target === hoveredNode.id && l.source === node.id)) : false;
            let isFaded = hoveredNode && !isHovered && !isConnected;

            // 光晕
            ctx.globalAlpha = isFaded ? 0.1 : 1;
            ctx.beginPath(); ctx.arc(node.x, node.y, node.radius + (isHovered ? 8 : 4), 0, Math.PI * 2); 
            ctx.fillStyle = node.color; ctx.globalAlpha = isHovered ? 0.3 : 0.1; ctx.fill();
            
            // 实体
            ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2); 
            ctx.fillStyle = node.color; ctx.globalAlpha = isFaded ? 0.2 : 1; ctx.fill();
            
            // 描边
            ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();

            // 【核心修改3：文字降噪逻辑 (Label Decluttering)】
            // 逻辑：大权重核心节点(>7)默认显示；被悬停或关联的节点强制显示；其余小节点隐藏文字。
            ctx.globalAlpha = 1;
            let isCoreNode = node.weight >= 7;
            if (isCoreNode || isHovered || isConnected) {
              ctx.font = isHovered ? "bold 13px sans-serif" : (isCoreNode ? "bold 12px sans-serif" : "11px sans-serif"); 
              ctx.fillStyle = isHovered ? "#0f172a" : (isCoreNode ? "#1e293b" : "#475569"); 
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              // 绘制文字白色描边提升可读性
              ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,0.8)";
              ctx.strokeText(node.name, node.x, node.y + node.radius + 14);
              ctx.fillText(node.name, node.x, node.y + node.radius + 14);
            }
          });
          ctx.globalAlpha = 1;
        }

        function loop() { simulate(); draw(); requestAnimationFrame(loop); }

        canvas.addEventListener('mousedown', e => {
          let rect = canvas.getBoundingClientRect(); let x = e.clientX - rect.left, y = e.clientY - rect.top;
          draggedNode = data.nodes.find(n => Math.hypot(n.x - x, n.y - y) < n.radius + 5);
          if(draggedNode) { draggedNode.vx = 0; draggedNode.vy = 0; }
        });

        canvas.addEventListener('mousemove', e => {
          let rect = canvas.getBoundingClientRect(); mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
          if (draggedNode) { draggedNode.x = mouseX; draggedNode.y = mouseY; }
          
          hoveredNode = data.nodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < n.radius + 5);
          if (hoveredNode && hoveredNode.description) {
            tooltip.style.opacity = 1; 
            tooltip.style.transform = "translateY(0)";
            tooltip.style.left = (e.clientX + 20) + 'px'; tooltip.style.top = (e.clientY + 20) + 'px';
            tooltip.innerHTML = '<span class="tag" style="background:' + hoveredNode.color + '20; color:' + hoveredNode.color + '">' + hoveredNode.typeTag + '</span><br/><strong>' + hoveredNode.name + '</strong><br/><span style="color:#cbd5e1; font-size:11px;">' + hoveredNode.description + '</span>';
          } else { 
            tooltip.style.opacity = 0; 
            tooltip.style.transform = "translateY(5px)";
          }
        });

        window.addEventListener('mouseup', () => draggedNode = null);
        
        const resizeObserver = new ResizeObserver(() => resizeCanvas());
        resizeObserver.observe(document.body);

        setTimeout(() => { resizeCanvas(); initNodes(); loop(); }, 100);
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