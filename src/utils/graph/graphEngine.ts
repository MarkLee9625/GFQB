import { generateRendererCode } from './Renderer';

export function generateGraphStyles(): string {
  return `
    body { margin: 0; overflow: hidden; background: #ffffff; font-family: system-ui, -apple-system, sans-serif; }
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

    @keyframes pulse {
      0% { opacity: 0.7; }
      50% { opacity: 1; text-shadow: 0 0 8px rgba(251, 191, 36, 0.5); }
      100% { opacity: 0.7; }
    }

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
}

export function generateGraphEngineCode(): string {
  return generateRendererCode() + `
function initGraph(data) {
    console.log('[Graph] initGraph start. Nodes:', data.nodes.length, 'Links:', data.links.length);
    const canvas = document.getElementById('graphCanvas');
    if (!canvas) {
      console.error('[Graph] Canvas element #graphCanvas not found');
      return;
    }
    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('tooltip');
    console.log('[Graph] Canvas found:', !!canvas, 'ctx:', !!ctx);

    let width = 800, height = 650;
    const colors = {
      technology: { main: '#3b82f6', tag: '技术' },
      process: { main: '#10b981', tag: '工艺' },
      material: { main: '#f59e0b', tag: '材料' },
      equipment: { main: '#8b5cf6', tag: '设备' },
      concept: { main: '#64748b', tag: '理念' },
      default: { main: '#3b82f6', tag: '节点' }
    };

    let isAllExpanded = false;
    let nodeMap = new Map();
    let adjacencyMap = new Map();
    let visibleNodesCache = [];
    let visibleLinksCache = [];
    let sortedNodesCache = [];
    let visualLinksCache = [];
    let visibilityDirty = true;

    var simulation = null;
    var needsRender = true;
    var _lastTickRender = 0;
    var renderer = new Renderer(ctx, width, height);

    function markDirty() {
      visibilityDirty = true;
      rebuildVisibilityCache();
      if (simulation) {
        simulation.nodes(visibleNodesCache);
        simulation.force("link").links(visibleLinksCache);
        simulation.alpha(0.1).restart();
      }
      needsRender = true;
    }

    function updateLinksVisibility() {
      data.links.forEach(function(link) {
        var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        var targetId = typeof link.target === 'object' ? link.target.id : link.target;
        var source = nodeMap.get(sourceId);
        var target = nodeMap.get(targetId);
        link.visible = source && target && source.visible && target.visible;
      });
      markDirty();
    }

    function rebuildVisibilityCache() {
      if (!visibilityDirty) return;
      visibleNodesCache.length = 0;
      visibleLinksCache.length = 0;
      for (var i = 0; i < data.nodes.length; i++) {
        if (data.nodes[i].visible) visibleNodesCache.push(data.nodes[i]);
      }
      for (var i = 0; i < data.links.length; i++) {
        if (data.links[i].visible) visibleLinksCache.push(data.links[i]);
      }
      sortedNodesCache = visibleNodesCache.slice().sort(function(a, b) { return (a.weight || 0) - (b.weight || 0); });

      var vlm = {};
      visibleLinksCache.forEach(function(link) {
        var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        var targetId = typeof link.target === 'object' ? link.target.id : link.target;

        link._sourceNode = nodeMap.get(sourceId);
        link._targetNode = nodeMap.get(targetId);

        var key = sourceId < targetId ? sourceId + '||' + targetId : targetId + '||' + sourceId;
        if (!vlm[key]) {
          vlm[key] = { source: sourceId, target: targetId, _sourceNode: link._sourceNode, _targetNode: link._targetNode, strength: link.strength, relationships: new Set([link.relationship]) };
        } else {
          vlm[key].relationships.add(link.relationship);
          if (link.strength > vlm[key].strength) vlm[key].strength = link.strength;
        }
      });
      visualLinksCache = Object.values(vlm);
      if (visualLinksCache.length > MAX_VISIBLE_LINKS && !showAllLinks) {
        visualLinksCache.sort(function(a, b) { return b.strength - a.strength; });
        visualLinksCache = visualLinksCache.slice(0, MAX_VISIBLE_LINKS);
      }

      data.nodes.forEach(function(node) {
        var neighbors = adjacencyMap.get(node.id) || [];
        node._hasHiddenNeighbors = neighbors.some(function(nid) { var n = nodeMap.get(nid); return n && !n.visible; });
      });
      visibilityDirty = false;
    }

    function initNodes() {
      if (width === 0 || height === 0) { width = 800; height = 600; }
      var minWeight = Infinity; var maxWeight = -Infinity;

      data.nodes.sort(function(a, b) { return b.weight - a.weight; });

      nodeMap.clear();
      adjacencyMap.clear();

      data.nodes.forEach(function(node, index) {
        if (node.weight < minWeight) minWeight = node.weight;
        if (node.weight > maxWeight) maxWeight = node.weight;

        node.visible = false;
        node._opacity = 0;
        node._targetOpacity = 0;

        node.vx = 0; node.vy = 0;
        var w = (typeof node.weight === 'number' && !isNaN(node.weight)) ? node.weight : 5;
        node.weight = w;
        node.radius = 8 + (w * 2.2);
        node.color = colors[node.type] ? colors[node.type].main : colors.default.main;
        node.typeTag = colors[node.type] ? colors[node.type].tag : colors.default.tag;

        var fontSizeRange = 15 - 9;
        var weightRatio = maxWeight === minWeight ? 0.5 : (node.weight - minWeight) / (maxWeight - minWeight);
        node.fontSize = 9 + weightRatio * fontSizeRange;
        node.roundedFontSize = Math.round(node.fontSize);

        node.x = 0; node.y = 0;

        nodeMap.set(node.id, node);
        adjacencyMap.set(node.id, []);
      });

      var matchedLinks = 0, orphanLinks = 0;
      data.links.forEach(function(link) {
        link._sourceNode = nodeMap.get(link.source);
        link._targetNode = nodeMap.get(link.target);
        if (link._sourceNode && link._targetNode) {
          adjacencyMap.get(link.source).push(link.target);
          adjacencyMap.get(link.target).push(link.source);
          matchedLinks++;
        } else {
          orphanLinks++;
        }
      });
      console.log('[Graph] initNodes: matchedLinks=' + matchedLinks + ', orphanLinks=' + orphanLinks + ', totalNodes=' + data.nodes.length + ', totalLinks=' + data.links.length);

      // 基于综合评分（weight + degree*1.5）的初始定位
      var degrees = {};
      data.links.forEach(function(link) {
        degrees[link.source] = (degrees[link.source] || 0) + 1;
        degrees[link.target] = (degrees[link.target] || 0) + 1;
      });
      data.nodes.forEach(function(n) {
        n._degree = degrees[n.id] || 0;
      });
      var nodeScores = data.nodes.map(function(n) {
        return { node: n, score: (n.weight || 5) + (degrees[n.id] || 0) * 1.5 };
      });
      nodeScores.sort(function(a, b) { return b.score - a.score; });
      var NODES_PER_RING = 8;
      var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
      nodeScores.forEach(function(item, i) {
        var ring = Math.floor(i / NODES_PER_RING);
        var posInRing = i % NODES_PER_RING;
        var ringRadius = Math.min(width, height) * (0.12 + ring * 0.15);
        var angle = posInRing * (2 * Math.PI / NODES_PER_RING) + ring * GOLDEN_ANGLE;
        item.node.x = width / 2 + Math.cos(angle) * ringRadius + (Math.random() - 0.5) * 4;
        item.node.y = height / 2 + Math.sin(angle) * ringRadius + (Math.random() - 0.5) * 4;
      });

      // 渐进式揭示：仅 weight >= 5 的核心节点初始可见，其余通过双击下钻动态生长
      data.nodes.forEach(function(n) {
        n.visible = n.weight >= 5;
        n._opacity = n.visible ? (n.weight >= 7 ? 1 : 0.4) : 0;
        n._targetOpacity = n.visible ? 1 : 0;
      });

      updateLinksVisibility();
      rebuildVisibilityCache();

      // 节点从静止开始，由 D3 力导向自然扩散

      console.log('[Graph] Creating D3 simulation. visibleNodes:', visibleNodesCache.length, 'visibleLinks:', visibleLinksCache.length, 'width:', width, 'height:', height);

      simulation = d3.forceSimulation(visibleNodesCache)
        .force("link", d3.forceLink(visibleLinksCache)
          .id(function(d) { return d.id; })
          .distance(function(l) { return 100 + (1 / Math.max(0.5, l.strength || 1)) * 60; })
          .strength(function(l) { return 0.10 * Math.min(l.strength || 1, 5); })
        )
        .force("charge", d3.forceManyBody()
          .strength(function(d) { return -550 - d.weight * 35; })
          .distanceMax(500)
        )
        .force("x", d3.forceX(width / 2).strength(0.04))
        .force("y", d3.forceY(height / 2).strength(0.04))
        .force("collide", d3.forceCollide()
          .radius(function(d) { return d.radius + 12; })
          .iterations(1)
          .strength(0.4)
        )
        .alphaDecay(0.022)
        .velocityDecay(0.45)
        .on("tick", function() {
          // NaN 防护：修复非法坐标
          visibleNodesCache.forEach(function(n) {
            if (isNaN(n.x) || !isFinite(n.x)) { n.x = width / 2 + (Math.random() - 0.5) * 20; n.vx = 0; }
            if (isNaN(n.y) || !isFinite(n.y)) { n.y = height / 2 + (Math.random() - 0.5) * 20; n.vy = 0; }
            if (isNaN(n.vx) || !isFinite(n.vx)) n.vx = 0;
            if (isNaN(n.vy) || !isFinite(n.vy)) n.vy = 0;
          });
          var now = performance.now();
          if (now - _lastTickRender >= 15) {
            _lastTickRender = now;
            renderTick();
          } else {
            needsRender = true;
          }
        })
        .on("end", function() { console.log('[Graph] D3 simulation ended (alpha < alphaMin)'); needsRender = true; });

      data.nodes.sort(function(a, b) { return a.weight - b.weight; });
    }

    let draggedNode = null, hoveredNode = null, selectedNode = null, mouseX = 0, mouseY = 0;
    let destroyed = false;
    let heartbeatIntervalId = null;
    let resizeObserverRef = null;
    let searchKeyword = '';
    const MAX_VISIBLE_LINKS = 100;
    let showAllLinks = false;

    let cameraScale = 1;
    let cameraOffsetX = 0;
    let cameraOffsetY = 0;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    function screenToWorld(x, y) {
      return {
        x: (x - cameraOffsetX) / cameraScale,
        y: (y - cameraOffsetY) / cameraScale
      };
    }

    var tickCount = 0;
    var firstRenderDone = false;
    function renderTick() {
      tickCount++;
      needsRender = false;
      if (!firstRenderDone) {
        console.log('[Graph] First renderTick #' + tickCount + ': visibleNodes=' + visibleNodesCache.length + ', sortedNodes=' + sortedNodesCache.length + ', visualLinks=' + visualLinksCache.length);
        firstRenderDone = true;
      }
      // 渐进揭示 opacity 插值
      var stillFading = false;
      data.nodes.forEach(function(n) {
        if (n._opacity < n._targetOpacity - 0.01) {
          n._opacity += (n._targetOpacity - n._opacity) * 0.06;
          if (n._opacity > 0.99 && n._targetOpacity >= 1) n._opacity = 1;
          stillFading = true;
        }
      });
      // 连线 opacity 跟随两端节点的最小 opacity
      data.links.forEach(function(l) {
        var s = l._sourceNode, t = l._targetNode;
        l._opacity = s && t ? Math.min(s._opacity, t._opacity) : 1;
      });

      if (stillFading) needsRender = true;

      rebuildVisibilityCache();
      var camera = { scale: cameraScale, offsetX: cameraOffsetX, offsetY: cameraOffsetY };
      renderer.draw(visibleNodesCache, visibleLinksCache, sortedNodesCache, visualLinksCache, camera, hoveredNode, selectedNode, searchKeyword, adjacencyMap);
    }

    function renderLoop() {
      if (destroyed) return;
      if (needsRender) {
        renderTick();
      }
      requestAnimationFrame(renderLoop);
    }

    let lastTooltipNodeId = null;

    canvas.addEventListener('mousedown', function(e) {
      var rect = canvas.getBoundingClientRect();
      var screenX = e.clientX - rect.left;
      var screenY = e.clientY - rect.top;
      var worldPos = screenToWorld(screenX, screenY);

      draggedNode = null;
      for (var i = visibleNodesCache.length - 1; i >= 0; i--) {
        var n = visibleNodesCache[i];
        if (Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5) {
          draggedNode = n;
          break;
        }
      }

      if (draggedNode) {
        draggedNode.fx = draggedNode.x;
        draggedNode.fy = draggedNode.y;
        simulation.alphaTarget(0.3).restart();
        needsRender = true;
      } else {
        isPanning = true; startPanX = screenX - cameraOffsetX; startPanY = screenY - cameraOffsetY;
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', function(e) {
      var rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;

      if (isPanning) {
        cameraOffsetX = mouseX - startPanX;
        cameraOffsetY = mouseY - startPanY;
        needsRender = true;
      } else {
        var worldPos = screenToWorld(mouseX, mouseY);
        if (draggedNode && !isPanning) {
          draggedNode.fx = worldPos.x;
          draggedNode.fy = worldPos.y;
        }

        hoveredNode = null;
        for (var i = visibleNodesCache.length - 1; i >= 0; i--) {
          var n = visibleNodesCache[i];
          if (Math.hypot(n.x - worldPos.x, n.y - worldPos.y) < n.radius + 5) {
            hoveredNode = n;
            break;
          }
        }

        if (hoveredNode && hoveredNode.description) {
          if (hoveredNode.id !== lastTooltipNodeId) {
            lastTooltipNodeId = hoveredNode.id;
            var hasHidden = hoveredNode._hasHiddenNeighbors;
            var neighborCount = (adjacencyMap.get(hoveredNode.id) || []).length;
            var statsLine = '<div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.15); color:#94a3b8; font-size:11px;">权重: ' + hoveredNode.weight + '/10 | 关联: ' + neighborCount + ' 个节点</div>';
            var hintHtml = '';
            if (hasHidden) {
              hintHtml = '<div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.2); color:#fbbf24; font-weight:bold; font-size:11px; display:flex; align-items:center; gap:4px; animation: pulse 2s infinite;">' +
                         '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>' +
                         '双击节点，下钻展开隐藏工艺</div>';
            }
            tooltip.innerHTML = '<span class="tag" style="background:' + hoveredNode.color + '20; color:' + hoveredNode.color + '">' + hoveredNode.typeTag + '</span><br/><strong>' + hoveredNode.name + '</strong><br/><span style="color:#cbd5e1; font-size:11px;">' + hoveredNode.description + '</span>' + statsLine + hintHtml;
            tooltip.style.opacity = 1; tooltip.style.transform = "translateY(0)";
          }
          var ttLeft = e.clientX + 20;
          var ttTop = e.clientY + 20;
          var ttWidth = tooltip.offsetWidth || 280;
          var ttHeight = tooltip.offsetHeight || 150;
          if (ttLeft + ttWidth > window.innerWidth) ttLeft = e.clientX - ttWidth - 10;
          if (ttTop + ttHeight > window.innerHeight) ttTop = e.clientY - ttHeight - 10;
          tooltip.style.left = ttLeft + 'px'; tooltip.style.top = ttTop + 'px';
        } else {
          tooltip.style.opacity = 0; tooltip.style.transform = "translateY(5px)";
          lastTooltipNodeId = null;
        }
      }
    });

    window.addEventListener('mouseup', function() {
      if (draggedNode) {
        draggedNode.fx = null;
        draggedNode.fy = null;
        simulation.alphaTarget(0);
      }
      draggedNode = null;
      isPanning = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', function() {
      draggedNode = null;
      isPanning = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      var zoomSensitivity = 0.001;
      var delta = -e.deltaY * zoomSensitivity;
      var newScale = cameraScale * (1 + delta);
      newScale = Math.max(0.1, Math.min(newScale, 5));

      var rect = canvas.getBoundingClientRect();
      var sX = e.clientX - rect.left;
      var sY = e.clientY - rect.top;

      cameraOffsetX = sX - (sX - cameraOffsetX) * (newScale / cameraScale);
      cameraOffsetY = sY - (sY - cameraOffsetY) * (newScale / cameraScale);
      cameraScale = newScale;
      needsRender = true;
      updateZoomText();
    }, { passive: false });

    var zoomResetBtn = document.getElementById('zoomReset');
    var drawerTitleEl = document.getElementById('drawerTitle');
    var drawerDescEl = document.getElementById('drawerDesc');
    var drawerTagEl = document.getElementById('drawerTag');
    var drawerLinksEl = document.getElementById('drawerLinks');

    function updateZoomText() {
      if (zoomResetBtn) zoomResetBtn.innerText = Math.round(cameraScale * 100) + '%';
    }

    document.getElementById('zoomIn').addEventListener('click', function() {
      var newScale = Math.min(cameraScale * 1.2, 5);
      cameraOffsetX = width/2 - (width/2 - cameraOffsetX) * (newScale / cameraScale);
      cameraOffsetY = height/2 - (height/2 - cameraOffsetY) * (newScale / cameraScale);
      cameraScale = newScale; updateZoomText();
      needsRender = true;
    });

    document.getElementById('zoomOut').addEventListener('click', function() {
      var newScale = Math.max(cameraScale / 1.2, 0.1);
      cameraOffsetX = width/2 - (width/2 - cameraOffsetX) * (newScale / cameraScale);
      cameraOffsetY = height/2 - (height/2 - cameraOffsetY) * (newScale / cameraScale);
      cameraScale = newScale; updateZoomText();
      needsRender = true;
    });

    document.getElementById('zoomReset').addEventListener('click', function() {
      cameraScale = 1; cameraOffsetX = 0; cameraOffsetY = 0;
      if (simulation) { simulation.alpha(0.1).restart(); }
      needsRender = true;
      updateZoomText();
    });

    var fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', function() {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      });
      document.addEventListener('fullscreenchange', function() {
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
    var lastResizeWidth = 0, lastResizeHeight = 0;
    var resizeDebounceTimer = null;

    function resizeCanvas() {
      var container = document.body;
      var newWidth = container.clientWidth;
      var newHeight = container.clientHeight;

      if (newWidth === 0 || newHeight === 0) return;

      width = newWidth;
      height = newHeight;
      canvas.width = width * (window.devicePixelRatio || 1);
      canvas.height = height * (window.devicePixelRatio || 1);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

      renderer.resize(width, height);

      if (!hasInitialized) {
        initNodes();
        hasInitialized = true;
        renderLoop();
        renderTick();
        if (heartbeatIntervalId) { clearInterval(heartbeatIntervalId); heartbeatIntervalId = null; }
      } else {
        var widthDiff = Math.abs(width - lastResizeWidth);
        var heightDiff = Math.abs(height - lastResizeHeight);
        if (widthDiff > 5 || heightDiff > 5) {
          if (simulation) {
            simulation.force("x", d3.forceX(width / 2).strength(0.04));
            simulation.force("y", d3.forceY(height / 2).strength(0.04));
            simulation.alpha(0.05).restart();
          }
          needsRender = true;
        }
      }
      lastResizeWidth = width;
      lastResizeHeight = height;
    }

    var resizeObserver = new ResizeObserver(function() {
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = setTimeout(resizeCanvas, 100);
    });
    resizeObserverRef = resizeObserver;
    resizeObserver.observe(document.body);
    setTimeout(function() { resizeCanvas(); }, 100);

    /* 心跳探针 */
    heartbeatIntervalId = setInterval(function() {
      if (!hasInitialized && document.body.clientWidth > 0 && document.body.clientHeight > 0) {
        console.log('[SWS Graph] 守护进程被激活：发现隐身恢复，强行引燃物理沙盘引擎...');
        resizeCanvas();
      }
    }, 250);

    /* 情报溯源面板 */
    var drawer = document.getElementById('drawer');
    var closeDrawer = document.getElementById('closeDrawer');

    canvas.addEventListener('click', function(e) {
      if (draggedNode) return;
      if (hoveredNode) {
        selectedNode = hoveredNode;
        openDrawer(selectedNode);
        needsRender = true;
      } else {
        selectedNode = null;
        drawer.classList.remove('open');
        needsRender = true;
      }
    });

    closeDrawer.addEventListener('click', function() {
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

      var neighbors = adjacencyMap.get(node.id) || [];
      var linksHtml = data.links.filter(function(l) {
        var sid = typeof l.source === 'object' ? l.source.id : l.source;
        var tid = typeof l.target === 'object' ? l.target.id : l.target;
        return sid === node.id || tid === node.id;
      }).map(function(l) {
        var sid = typeof l.source === 'object' ? l.source.id : l.source;
        var tid = typeof l.target === 'object' ? l.target.id : l.target;
        var isSource = sid === node.id;
        var otherNodeId = isSource ? tid : sid;
        var otherNode = nodeMap.get(otherNodeId);
        if(!otherNode) return '';
        var direction = isSource ? '→ 输出至' : '← 来源于';
        var strength = l.strength || 1;
        var dots = [1,2,3,4,5].map(function(i) { return '<span class="rel-dot' + (i <= strength ? ' active' : '') + '"></span>'; }).join('');
        return '<div class="relation-item">' +
          '<span style="font-weight:bold; color:#334155;">' + otherNode.name + '</span>' +
          '<span class="rel-badge">' + direction + ': ' + l.relationship + '</span>' +
          '<span class="rel-strength">' + dots + '</span>' +
        '</div>';
      }).join('');

      if (drawerLinksEl) drawerLinksEl.innerHTML = linksHtml || '<div style="color:#94a3b8; font-size:12px; text-align:center; margin-top:20px;">暂无直接关联</div>';
      drawer.classList.add('open');
    }

    drawerLinksEl.addEventListener('click', function(e) {
      var item = e.target.closest('.relation-item');
      if (item && selectedNode) {
        var otherName = item.querySelector('span[style*="font-weight"]') ? item.querySelector('span[style*="font-weight"]').textContent.trim() : '';
        var target = data.nodes.find(function(n) { return n.name === otherName; });
        if (target) openDrawer(target);
      }
    });

    document.getElementById('searchInput').addEventListener('input', function(e) {
      searchKeyword = (e.target.value || '').trim().toLowerCase();
      needsRender = true;
    });

    document.getElementById('traceBtn').addEventListener('click', function() {
      if (selectedNode) {
        try {
          window.parent.postMessage({ type: 'GRAPH_SEARCH_KEYWORD', keyword: selectedNode.name }, '*');
        } catch (e) {
          console.warn('[安全拦截] 离线阅读器环境下，跨帧通信受限，已拦截异常保证图谱交互正常。', e);
        }
        var btn = document.getElementById('traceBtn');
        var originalText = btn.innerHTML;
        btn.innerHTML = '已触发页面检索...';
        btn.style.background = '#10b981';
        setTimeout(function() {
          btn.innerHTML = originalText;
          btn.style.background = '#0f172a';
        }, 2000);
      }
    });

    /* 智能双向折叠引擎 */
    canvas.addEventListener('dblclick', function(e) {
      if (!hoveredNode) return;

      var neighbors = [];
      var neighborIds = adjacencyMap.get(hoveredNode.id) || [];
      neighborIds.forEach(function(nid) {
        var n = nodeMap.get(nid);
        if (n) neighbors.push(n);
      });

      var hasHidden = neighbors.some(function(n) { return !n.visible; });

      if (hasHidden) {
        var hasSpawned = false;
        var hiddenNeighbors = neighbors.filter(function(n) { return !n.visible; });
        var spawnRadius = 130;
        hiddenNeighbors.forEach(function(otherNode, i) {
          var angle = (i / hiddenNeighbors.length) * 2 * Math.PI + Math.random() * 0.3;
          otherNode.x = hoveredNode.x + Math.cos(angle) * spawnRadius;
          otherNode.y = hoveredNode.y + Math.sin(angle) * spawnRadius;
          otherNode.visible = true;
          otherNode._opacity = 0.08;
          otherNode._targetOpacity = 1;
          hasSpawned = true;
        });
        if (hasSpawned) {
          updateLinksVisibility();
          if (simulation) { simulation.alpha(0.3).restart(); }
        }
      } else {
        var hasCollapsed = false;
        neighbors.forEach(function(otherNode) {
          var visibleConnections = 0;
          var otherNeighborIds = adjacencyMap.get(otherNode.id) || [];
          otherNeighborIds.forEach(function(connectedId) {
            var connectedNode = nodeMap.get(connectedId);
            if (connectedNode && connectedNode.visible) visibleConnections++;
          });
          if (visibleConnections <= 1) {
            otherNode.visible = false;
            hasCollapsed = true;
          }
        });
        if (hasCollapsed) {
          updateLinksVisibility();
          if (simulation) { simulation.alpha(0.1).restart(); }
        }
      }
    });

    // 一键展开/收起按钮
    document.getElementById('toggleExpand').addEventListener('click', function(e) {
      isAllExpanded = !isAllExpanded;
      e.target.innerText = isAllExpanded ? "重置收起" : "展开全部";

      if (isAllExpanded) {
        var totalNodes = data.nodes.length;
        var spreadRadius = Math.min(width, height) * 0.42;
        data.nodes.forEach(function(n, i) {
          if (!n.visible) {
            n.visible = true;
            n._opacity = 0.08;
            n._targetOpacity = 1;
          }
          var deg = n._degree || 0;
          var angleRatio = i / totalNodes;
          var radiusRatio = deg > 3 ? 0.2 + angleRatio * 0.4 : 0.4 + angleRatio * 0.6;
          var angle = angleRatio * Math.PI * 2 * 3 + (Math.random() - 0.5) * 0.2;
          n.x = width / 2 + Math.cos(angle) * spreadRadius * radiusRatio;
          n.y = height / 2 + Math.sin(angle) * spreadRadius * radiusRatio;
          n.vx = 0;
          n.vy = 0;
        });
        updateLinksVisibility();
        if (simulation) { simulation.alpha(0.3).restart(); }
      } else {
        var sorted = data.nodes.slice().sort(function(a, b) { return b.weight - a.weight; });
        sorted.forEach(function(n, i) {
          if (i < 20) {
            if (!n.visible) {
              n.visible = true;
              n._opacity = 0.3;
              n._targetOpacity = 1;
            }
            var t = i / 20;
            var spiralAngle = t * Math.PI * 2 * 3;
            var spiralR = Math.min(width, height) * 0.28 * Math.sqrt(t);
            n.x = width / 2 + Math.cos(spiralAngle) * spiralR;
            n.y = height / 2 + Math.sin(spiralAngle) * spiralR;
            n.vx = 0;
            n.vy = 0;
          } else {
            n.visible = false;
            n._opacity = 0;
            n._targetOpacity = 0;
          }
        });
        updateLinksVisibility();
        if (simulation) { simulation.alpha(0.2).restart(); }
      }
      needsRender = true;
    });

    document.getElementById('toggleLinks').addEventListener('click', function(e) {
      showAllLinks = !showAllLinks;
      e.target.innerText = showAllLinks ? "全部链路" : "精简链路";
      markDirty();
    });

    window.addEventListener('beforeunload', function() {
      destroyed = true;
      if (simulation) simulation.stop();
      if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
      if (resizeObserverRef) resizeObserverRef.disconnect();
    });
  }
`;
}
