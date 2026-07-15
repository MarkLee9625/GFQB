/**
 * Renderer.ts — Canvas 绘制流水线
 *
 * 职责：
 *   1. 点阵背景渲染（Obsidian 风格浅色纸张感）
 *   2. 连线绘制（含箭头、高亮、曲率、关系文字、视口裁剪）
 *   3. 节点绘制（含虚线环、选中态、标签文字描边护线）
 *   4. 视口裁剪（Viewport Culling）— 源/目标均在视口外时跳过连线绘制
 *
 * 【使用方式】
 *   const renderer = new Renderer(ctx, width, height);
 *   renderer.draw(nodes, links, sortedNodes, visualLinks, camera, hoveredNode, selectedNode, searchKeyword, adjacencyMap);
 */

// ========== 代码生成（注入 iframe 用） ==========

export function generateRendererCode(): string {
  return `
/* ===== Renderer — Canvas 渲染流水线 ===== */

/**
 * 创建渲染器
 *
 * @param {CanvasRenderingContext2D} ctx — 主画布的 2D 上下文
 * @param {number} width  — 逻辑宽度
 * @param {number} height — 逻辑高度
 */
function Renderer(ctx, width, height) {
  this.ctx = ctx;
  this.width = width;
  this.height = height;
  /** 颜色表（与主应用保持一致） */
  this.colors = {
    technology: { main: '#3b82f6', tag: '技术' },
    process:    { main: '#10b981', tag: '工艺' },
    material:   { main: '#f59e0b', tag: '材料' },
    equipment:  { main: '#8b5cf6', tag: '设备' },
    concept:    { main: '#64748b', tag: '理念' },
    default:    { main: '#3b82f6', tag: '节点' }
  };
}

/** 更新画布尺寸 */
Renderer.prototype.resize = function (width, height) {
  if (this.width === width && this.height === height) return;
  this.width = width;
  this.height = height;
};

/**
 * 主绘制入口
 *
 * @param {Array}  nodes        — 可见节点列表（含渲染属性 x/y/radius/color 等）
 * @param {Array}  links        — 可见连线列表
 * @param {Array}  sortedNodes  — 按 weight 排序后的节点（用于绘制顺序）
 * @param {Array}  visualLinks  — 去重聚合后的连线（含 relationships Set）
 * @param {object} camera       — { scale, offsetX, offsetY }
 * @param {object|null} hoveredNode
 * @param {object|null} selectedNode
 * @param {string}  searchKeyword
 * @param {Map}     adjacencyMap — 邻接表
 */
Renderer.prototype.draw = function (nodes, links, sortedNodes, visualLinks, camera, hoveredNode, selectedNode, searchKeyword, adjacencyMap) {
  var ctx = this.ctx;
  var w = this.width, h = this.height;
  var cs = camera.scale;
  var cox = camera.offsetX, coy = camera.offsetY;

  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(cox, coy);
  ctx.scale(cs, cs);

  /* ---- 背景 ---- */
  this._renderBackground(ctx, w, h, cs, cox, coy);

  /* ---- 视口世界坐标边界（用于连线裁剪） ---- */
  var viewLeft = -cox / cs;
  var viewTop = -coy / cs;
  var viewRight = viewLeft + w / cs;
  var viewBottom = viewTop + h / cs;

  /* ---- 连线 ---- */
  this._renderLinks(ctx, visualLinks, hoveredNode, selectedNode, searchKeyword, cs, viewLeft, viewTop, viewRight, viewBottom);

  /* ---- 节点 ---- */
  this._renderNodes(ctx, sortedNodes, hoveredNode, selectedNode, searchKeyword, adjacencyMap, cs);

  ctx.restore();
};

/**
 * 渲染点阵背景（Obsidian 风格浅色纸张感）
 */
Renderer.prototype._renderBackground = function (ctx, w, h, cs, cox, coy) {
  var left = -cox / cs;
  var top = -coy / cs;
  var right = left + w / cs;
  var bottom = top + h / cs;
  var pad = 50;

  // 干净纯白底色（覆盖可见视口范围）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(left - pad, top - pad, right - left + pad * 2, bottom - top + pad * 2);

  // 性能保护：低缩放比时稀疏点阵或跳过
  var spacing = 40;
  if (cs < 0.15) return;
  if (cs < 0.4) spacing = 80;

  var startX = Math.floor(left / spacing) * spacing;
  var startY = Math.floor(top / spacing) * spacing;
  ctx.fillStyle = '#e2e8f0';

  for (var gx = startX; gx <= right; gx += spacing) {
    for (var gy = startY; gy <= bottom; gy += spacing) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/**
 * 渲染全部连线（含箭头、高亮、曲率、关系文字）
 */
Renderer.prototype._renderLinks = function (ctx, visualLinks, hoveredNode, selectedNode, searchKeyword, cs, left, top, right, bottom) {
  ctx.save();

  for (var i = 0; i < visualLinks.length; i++) {
    var link = visualLinks[i];
    var source = link._sourceNode;
    var target = link._targetNode;
    if (!source || !target) continue;

    // 视口裁剪（含 50px 安全缓冲区，防止弯曲连线在边缘突兀消失）
    var pad = 50;
    var sourceOutside = source.x < (left - pad) || source.x > (right + pad) || source.y < (top - pad) || source.y > (bottom + pad);
    var targetOutside = target.x < (left - pad) || target.x > (right + pad) || target.y < (top - pad) || target.y > (bottom + pad);
    if (sourceOutside && targetOutside) continue;

    var linkOpacity = link._opacity != null ? link._opacity : 1;
    var isHighlight = hoveredNode === source || hoveredNode === target ||
                      selectedNode === source || selectedNode === target;
    var isFaded = (hoveredNode || selectedNode) && !isHighlight;

    // 搜索关键词高亮
    if (searchKeyword) {
      var kw = searchKeyword;
      var sm = source.name.toLowerCase().indexOf(kw) >= 0 || (source.description || '').toLowerCase().indexOf(kw) >= 0;
      var tm = target.name.toLowerCase().indexOf(kw) >= 0 || (target.description || '').toLowerCase().indexOf(kw) >= 0;
      if (!sm && !tm) isFaded = true;
      else isFaded = false;
    }

    var angle = Math.atan2(target.y - source.y, target.x - source.x);
    var isTargetHov = hoveredNode === target || selectedNode === target;
    var tRad = target.radius + (isTargetHov ? 8 : 4) + 2;
    var arrowX = target.x - Math.cos(angle) * tRad;
    var arrowY = target.y - Math.sin(angle) * tRad;
    var arrowSize = Math.min(8 / cs, target.radius * 1.2);

    var dx = target.x - source.x;
    var dy = target.y - source.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var relCount = link.relationships ? link.relationships.size : 1;
    var staggerIdx = link._bundleIndex || 0;
    var curvature = 0;
    if (relCount > 1) {
      var baseCurve = Math.min(20 + relCount * 4, 55);
      var direction = (staggerIdx % 2 === 0) ? 1 : -1;
      curvature = direction * baseCurve;
    }
    var linkStrength = link.strength || 1;

    // 画连线
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    if (curvature !== 0 && dist > 0) {
      var midX = (source.x + target.x) / 2;
      var midY = (source.y + target.y) / 2;
      var perpX = -(dy / dist) * Math.abs(curvature);
      var perpY =  (dx / dist) * Math.abs(curvature);
      if (curvature < 0) { perpX = -perpX; perpY = -perpY; }
      ctx.quadraticCurveTo(midX + perpX, midY + perpY, arrowX, arrowY);
    } else {
      ctx.lineTo(arrowX, arrowY);
    }
    var baseWidth = 1 / cs;
    var highlightWidth = 1.5 / cs;
    ctx.strokeStyle = isHighlight ? '#3b82f6' : '#e2e8f0';
    ctx.lineWidth = isHighlight ? highlightWidth : baseWidth;
    ctx.globalAlpha = (isFaded ? 0.05 : (isHighlight ? 0.85 : 0.6)) * linkOpacity;
    ctx.stroke();

    // 画箭头
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = isHighlight ? '#3b82f6' : '#94a3b8';
    ctx.globalAlpha = (isFaded ? 0.05 : (isHighlight ? 1 : 0.6)) * linkOpacity;
    ctx.fill();

    // 显示关系文字（高亮或缩放 > 0.7 时展示）
    var showRelLabel = link.relationships && (isHighlight || cs > 0.7);
    if (showRelLabel) {
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = (isHighlight ? 1 : 0.6) * linkOpacity;
      var relText = Array.from ? Array.from(link.relationships).join(' / ') : '';
      var tx = (source.x + target.x) / 2;
      var ty = (source.y + target.y) / 2 - 6;
      // 背景药丸
      ctx.save();
      var textWidth = ctx.measureText(relText).width;
      var pad = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      var rx = tx - textWidth/2 - pad;
      var ry = ty - 8;
      var rw = textWidth + pad*2;
      var rh = 18;
      ctx.beginPath();
      ctx.moveTo(rx + 4, ry);
      ctx.lineTo(rx + rw - 4, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + 4);
      ctx.lineTo(rx + rw, ry + rh - 4);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - 4, ry + rh);
      ctx.lineTo(rx + 4, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - 4);
      ctx.lineTo(rx, ry + 4);
      ctx.quadraticCurveTo(rx, ry, rx + 4, ry);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
      // 文字
      ctx.fillStyle = isHighlight ? "#3b82f6" : "#475569";
      ctx.lineWidth = 3 / cs;
      ctx.strokeStyle = "rgba(255,255,255,0)";
      ctx.lineJoin = 'round';
      ctx.fillText(relText, tx, ty);
    }
  }
  ctx.restore();
};

/**
 * 渲染全部节点
 */
Renderer.prototype._renderNodes = function (ctx, sortedNodes, hoveredNode, selectedNode, searchKeyword, adjacencyMap, cs) {
  var focusNode = hoveredNode || selectedNode;
  var focusNeighbors = focusNode ? (adjacencyMap.get(focusNode.id) || []) : [];

  ctx.save();

  for (var i = 0; i < sortedNodes.length; i++) {
    var node = sortedNodes[i];
    // NaN 防护：跳过坐标或半径为非法值的节点
    if (isNaN(node.x) || isNaN(node.y) || isNaN(node.radius) || !isFinite(node.x) || !isFinite(node.y) || !isFinite(node.radius)) continue;
    var nodeOpacity = node._opacity != null ? node._opacity : 1;
    var isHovered = hoveredNode === node || selectedNode === node;
    var isConnected = focusNode ? focusNeighbors.indexOf(node.id) >= 0 : false;
    var isFaded = focusNode && !isHovered && !isConnected;

    // 搜索过滤
    if (searchKeyword) {
      var kw = searchKeyword;
      var match = node.name.toLowerCase().indexOf(kw) >= 0 || (node.description || '').toLowerCase().indexOf(kw) >= 0;
      if (!match) isFaded = true;
      else isFaded = false;
    }

    /* ---- 虚线环（有隐藏邻居时） ---- */
    if (node._hasHiddenNeighbors) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 1.5 / cs;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* ---- 节点圆形本体（实心纯色 + 白色边框） ---- */
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.globalAlpha = (isFaded ? 0.06 : 1) * nodeOpacity;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.5 / cs);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();

    // 权重 >= 6 的节点中心显示完整类型名称
    if (node.weight >= 6 && !isFaded) {
      ctx.font = "bold 8px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.typeTag, node.x, node.y);
    }

    /* ---- 文字标签（默认无底板，hover 时显示底板） ---- */
    var showLabel = isHovered || (cs >= 0.8 && node._opacity > 0.6) || (node.weight >= 6 && cs >= 0.6) || (node.weight >= 8);
    if (showLabel) {
      ctx.globalAlpha = nodeOpacity;
      ctx.font = (isHovered ? "bold " : "") + node.roundedFontSize + "px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 文本多行分割（贪心分词，maxWidth 限制单行最大宽度）
      var maxWidth = 110;
      var lineHeight = node.roundedFontSize * 1.4;
      var chars = node.name.split('');
      var lines = [];
      var currentLine = '';
      var maxLineWidth = 0;

      for (var j = 0; j < chars.length; j++) {
        var testLine = currentLine + chars[j];
        var testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidth && j > 0) {
          lines.push(currentLine);
          maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width);
          currentLine = chars[j];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width);

      // 行数上限，防止遮挡图谱；hover 时放宽
      var maxLines = isHovered ? 4 : 2;
      if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -2) + '...';
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(lines[maxLines - 1]).width);
      }

      if (isHovered) {
        // hover：显示白色阴影底板 + 深色文字
        var labelPadX = 10;
        var labelPadY = 8;
        var labelWidth = maxLineWidth + labelPadX * 2;
        var labelHeight = lines.length * lineHeight + labelPadY * 2;
        var labelY = node.y + node.radius + 10;
        var labelX = node.x - labelWidth / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // 圆角矩形底板
        var lr = 6;
        ctx.beginPath();
        ctx.moveTo(labelX + lr, labelY);
        ctx.lineTo(labelX + labelWidth - lr, labelY);
        ctx.quadraticCurveTo(labelX + labelWidth, labelY, labelX + labelWidth, labelY + lr);
        ctx.lineTo(labelX + labelWidth, labelY + labelHeight - lr);
        ctx.quadraticCurveTo(labelX + labelWidth, labelY + labelHeight, labelX + labelWidth - lr, labelY + labelHeight);
        ctx.lineTo(labelX + lr, labelY + labelHeight);
        ctx.quadraticCurveTo(labelX, labelY + labelHeight, labelX, labelY + labelHeight - lr);
        ctx.lineTo(labelX, labelY + lr);
        ctx.quadraticCurveTo(labelX, labelY, labelX + lr, labelY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 逐行渲染文字（底板模式，无需描边）
        ctx.fillStyle = "#0f172a";
        var startTextY = labelY + labelPadY + lineHeight / 2;
        for (var k = 0; k < lines.length; k++) {
          ctx.fillText(lines[k], node.x, startTextY + k * lineHeight);
        }
      } else {
        // 非 hover：描边文字（白色 3px 护边 + 深色填充，无需底板）
        ctx.save();
        ctx.lineWidth = 3 / cs;
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';
        ctx.fillStyle = "#334155";
        var textStartY = node.y + node.radius + 16 + lineHeight / 2;
        for (var k = 0; k < lines.length; k++) {
          var ty = textStartY + k * lineHeight;
          ctx.strokeText(lines[k], node.x, ty);
          ctx.fillText(lines[k], node.x, ty);
        }
        ctx.restore();
      }
    }
  }
  ctx.restore();
};
`;
}
