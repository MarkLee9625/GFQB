import { SHARED_STYLES, MAGAZINE_STYLES, PRINT_STYLES, MISC_STYLES, SEASONAL_STYLES, SVG_ICONS } from './assets';

export function getClientScript() {
    return `
    // 辅助函数：安全解析 JSON 数据
    function getJsonData(id) {
        var el = document.getElementById(id);
        if (!el) {
            console.error('[Reader] 未找到数据元素: ' + id);
            return null;
        }
        try {
            var text = el.textContent || el.innerText;
            if (!text || text.trim().length === 0) {
                console.error('[Reader] 数据元素为空: ' + id);
                return null;
            }
            console.log('[Reader] 正在解析数据: ' + id + ', 长度: ' + text.length);
            var data = JSON.parse(text);
            console.log('[Reader] 解析成功: ' + id);
            return data;
        } catch (e) {
            console.error('[Reader] JSON解析失败 for ' + id + ':', e);
            console.error('[Reader] 原始文本前100字符:', el.textContent.substring(0, 100));
            return null;
        }
    }

    // 辅助函数：列表遍历
    function forEach(list, callback) {
        if (!list) return;
        for (var i = 0; i < list.length; i++) {
            callback(list[i], i);
        }
    }

    // 辅助函数：转义 HTML
    function escapeForJS(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 辅助函数：查找父级元素
    function findParent(el, cls) {
        while (el && el !== document) {
            if (el.classList && el.classList.contains(cls)) return el;
            el = el.parentNode;
        }
        return null;
    }

    
    var DATA = window.__SWS_DATA_ARTICLES__ || [];
    var CONFIG = window.__SWS_DATA_CONFIG__ || {};
    var APP_COMPANY = CONFIG.company || {};
    var LOGO = CONFIG.logo || "";
    
    console.log('[Reader] 数据加载完成，文章数量:', (DATA && DATA.length) || 0);


    var app = {
        data: Array.isArray(DATA) ? DATA : [],
        currentIndex: 0,
        alternateDesign: CONFIG.alternateDesign || false,
        currentBlobUrls: [],

        base64ToBlobUrl: function(base64) {
            if (!base64) return null;
            if (base64.indexOf('data:') !== 0) return base64;
            try {
                var split = base64.split(',');
                var type = split[0].match(/:(.*?);/)[1];
                var bin = atob(split[1]);
                var len = bin.length;
                var arr = new Uint8Array(len);
                for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
                var blob = new Blob([arr], { type: type });
                var url = URL.createObjectURL(blob);
                this.currentBlobUrls.push(url);
                return url;
            } catch(e) { console.error("Blob conversion failed", e); return base64; }
        },

        init: function() {
            try {
                console.log('[Reader] 极速启动，数据长度:', this.data.length);
                
                // 极速首屏：只渲染封面
                this.renderAll();
                
                // 立即显示封面，不使用requestAnimationFrame
                this.updateView(0);
                console.log('[Reader] 封面已立即显示');
                
                // 延迟渲染侧边栏列表
                setTimeout(function() {
                    app.renderList();
                    console.log('[Reader] 侧边栏加载完成');
                }, 100);

                var searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.addEventListener('input', function(e) {
                        var term = e.target.value.toLowerCase();
                        app.renderList(term);
                    });
                }

                document.addEventListener('keydown', function(e) {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
                    
                    switch(e.key) {
                        case 'ArrowRight':
                        case 'PageDown':
                        case 'n':
                        case 'N':
                            app.next();
                            e.preventDefault();
                            break;
                        case 'ArrowLeft':
                        case 'PageUp':
                        case 'p':
                        case 'P':
                            app.prev();
                            e.preventDefault();
                            break;
                        case 'Home':
                            app.scrollToArticle(0);
                            e.preventDefault();
                            break;
                        case 'End':
                            app.scrollToArticle(app.data.length - 1);
                            e.preventDefault();
                            break;
                        case ' ': // Space key
                            // Removed automatic paging to next article via space to keep consistent with editor
                            break;
                    }
                });
            } catch (err) { console.error("App init error", err); }
        },

        toggleSidebar: function() {
            document.getElementById('sidebar').classList.toggle('hidden');
        },

        toggleFullscreen: function() {
            var docEl = document.documentElement;
            var request = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
            var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
                if (request) request.call(docEl);
            } else {
                if (exit) exit.call(document);
            }
        },

        renderList: function(term) {
            term = term || '';
            var listEl = document.getElementById('article-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            this.data.forEach(function(item, index) {
                if (term && item.title.toLowerCase().indexOf(term) === -1) return;
                var li = document.createElement('li');
                li.className = 'nav-item ' + (index === app.currentIndex ? 'active' : '');
                li.id = 'nav-item-' + index;
                li.onclick = function() { app.scrollToArticle(index); };

                var isSpecial = item.category === '封面' || item.category === '封底';
                li.innerHTML = '<div class="nav-item-title ' + (isSpecial ? 'special-title' : '') + '">' + escapeForJS(item.title) + '</div>' +
                               '<div class="nav-item-meta"><span>' + escapeForJS(item.date || '') + '</span></div>';
                listEl.appendChild(li);
            });
        },

        renderAll: function() {
            var container = document.getElementById('render-target');
            if (!container) {
                console.error('[Reader] 未找到 render-target 容器！');
                return;
            }
            console.log('[Reader] 极速首屏：只渲染封面');
            container.innerHTML = '';
            
            // 【极速首屏】只渲染第一篇（封面）
            if (this.data.length > 0) {
                var firstArticle = this.data[0];
                var wrapper = document.createElement('div');
                wrapper.className = 'article-wrapper';
                wrapper.id = 'article-0';
                if (firstArticle.category === '封面') app.renderCover(wrapper, firstArticle);
                else if (firstArticle.category === '封底') app.renderBack(wrapper, firstArticle);
                else app.renderNormal(wrapper, firstArticle);
                container.appendChild(wrapper);
                console.log('[Reader] 封面已显示');
            }
            
            // 延迟渲染所有其他文章
            setTimeout(function() {
                var frag = document.createDocumentFragment();
                for (var i = 1; i < app.data.length; i++) {
                    var article = app.data[i];
                    var wrapper = document.createElement('div');
                    wrapper.className = 'article-wrapper';
                    wrapper.id = 'article-' + i;
                    if (article.category === '封面') app.renderCover(wrapper, article);
                    else if (article.category === '封底') app.renderBack(wrapper, article);
                    else app.renderNormal(wrapper, article);
                    frag.appendChild(wrapper);
                }
                container.appendChild(frag);
                console.log('[Reader] 后台加载完成，共', app.data.length, '篇');
            }, 50);
        },

        renderCover: function(el, article) {
            var templateId = this.alternateDesign ? 'tpl-magazine-cover' : 'tpl-normal-cover';
            var tpl = document.getElementById(templateId);
            if (!tpl) return;
            var node;
            if (tpl.content) {
                node = tpl.content.cloneNode(true);
            } else {
                var div = document.createElement('div');
                div.innerHTML = tpl.innerHTML;
                node = document.createDocumentFragment();
                while (div.firstChild) {
                    node.appendChild(div.firstChild);
                }
            }
            var coverImgUrl = this.base64ToBlobUrl(article.coverImage);
            var issueText = article.issueText || "NO.01";
            var dateText = article.dateText || "JAN 2025";

            var metaBadges = node.querySelectorAll('[data-field="issueText"], [data-field="dateText"]');
            forEach(metaBadges, function(elem) {
                if (elem.dataset.field === 'issueText') elem.textContent = issueText;
                if (elem.dataset.field === 'dateText') elem.textContent = dateText;
            });

            var imagePlaceholder = node.querySelector('.magazine-image-placeholder') || node.querySelector('.cover-img-placeholder');
            if (coverImgUrl) {
                var img = document.createElement('img');
                img.src = coverImgUrl;
                img.className = imagePlaceholder.className.indexOf('magazine') !== -1 ? 'magazine-image' : 'cover-img';
                img.alt = "Cover";
                if (!this.alternateDesign) {
                    var s = parseFloat(article.scale) || 1;
                    var x = parseFloat(article.posX) || 0;
                    var y = parseFloat(article.posY) || 0;
                    img.style.transformOrigin = 'center';
                    img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                }
                if (imagePlaceholder) imagePlaceholder.parentNode.replaceChild(img, imagePlaceholder);
                var ambientBg = node.querySelector('.ambient-bg');
                if (!this.alternateDesign && ambientBg) {
                    ambientBg.style.backgroundImage = 'url(' + coverImgUrl + ')';
                }
            }
            el.appendChild(node);
            var startBtn = el.querySelector('.magazine-button');
            if (startBtn) startBtn.onclick = function(e) { e.preventDefault(); app.next(); };
        },

        renderBack: function(el, article) {
            var templateId = this.alternateDesign ? 'tpl-magazine-back' : 'tpl-normal-back';
            var tpl = document.getElementById(templateId);
            if (!tpl) return;
            var node = tpl.content.cloneNode(true);
            var backImgUrl = this.base64ToBlobUrl(article.backImage);

            if (this.alternateDesign) {
                var fields = node.querySelectorAll('[data-field]');
                forEach(fields, function(elem) {
                    var field = elem.dataset.field;
                    if (field === 'logo') { if (LOGO) elem.src = LOGO; else elem.style.display = 'none'; }
                    if (field === 'issueText') elem.textContent = article.issueText || "NO.01";
                    if (field === 'dateText') elem.textContent = article.dateText || "JAN 2025";
                });
                var imgContainer = node.querySelector('.magazine-back-image-container');
                var placeholder = node.querySelector('.magazine-image-placeholder');
                if (backImgUrl && imgContainer) {
                    var img = document.createElement('img');
                    img.className = 'magazine-back-image';
                    img.src = backImgUrl;
                    if (placeholder) imgContainer.replaceChild(img, placeholder); else imgContainer.appendChild(img);
                }
            } else {
                var fields = node.querySelectorAll('[data-field]');
                forEach(fields, function(elem) {
                    if (elem.dataset.field === 'logo') {
                        var imgElem = elem.tagName === 'IMG' ? elem : elem.querySelector('img');
                        if (imgElem) { if (LOGO) imgElem.src = LOGO; else imgElem.style.display = 'none'; }
                    }
                });
                var bgContainer = node.querySelector('[data-field="bgStyle"]');
                if (bgContainer && backImgUrl) {
                    bgContainer.style.backgroundImage = 'url(' + backImgUrl + ')';
                    bgContainer.style.backgroundSize = 'cover';
                    bgContainer.style.backgroundPosition = 'center';
                    bgContainer.style.opacity = '0.3';
                    bgContainer.style.filter = 'blur(60px) saturate(180%) brightness(1.05)';
                    bgContainer.style.transform = 'scale(1.2)';
                }
                var imgContainer = node.querySelector('.cover-img-box');
                var placeholder = node.querySelector('.cover-img-placeholder');
                if (backImgUrl && imgContainer) {
                    var img = document.createElement('img');
                    img.className = 'cover-img';
                    img.src = backImgUrl;
                    img.style.boxShadow = '0 20px 50px -12px rgba(0, 0, 0, 0.5)';
                    if (article.scale !== undefined) {
                        var s = parseFloat(article.scale) || 1;
                        var x = parseFloat(article.posX) || 0;
                        var y = parseFloat(article.posY) || 0;
                        img.style.transformOrigin = 'center';
                        img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                    }
                    if (placeholder) imgContainer.replaceChild(img, placeholder); else imgContainer.appendChild(img);
                }
            }
            el.appendChild(node);
        },

        renderNormal: function(el, article) {
            var tpl = document.getElementById('tpl-article');
            if (!tpl) return;
            var node;
            if (tpl.content) {
                node = tpl.content.cloneNode(true);
            } else {
                var div = document.createElement('div');
                div.innerHTML = tpl.innerHTML;
                node = document.createDocumentFragment();
                while (div.firstChild) {
                    node.appendChild(div.firstChild);
                }
            }
            var fields = node.querySelectorAll('[data-field]');
            forEach(fields, function(elem) {
                var field = elem.dataset.field;
                if (field === 'title') elem.textContent = article.title || '';
                if (field === 'date') elem.textContent = article.date || '';
                if (field === 'category') elem.textContent = article.category || '';
                if (field === 'category-label') {
                    if (article.tags && article.tags.length > 0) elem.style.display = 'none';
                    else elem.style.display = 'inline-block';
                }
                if (field === 'tags') {
                    var tagsArr = Array.isArray(article.tags) ? article.tags : [];
                    if (tagsArr.length > 0) {
                        elem.innerHTML = tagsArr.map(function(t) { return '<span class="tag-item">' + t + '</span>'; }).join('');
                        elem.style.display = 'flex';
                    } else elem.style.display = 'none';
                }
                if (field === 'tags-icon') {
                    if (article.tags && article.tags.length > 0) elem.style.display = 'block';
                    else elem.style.display = 'none';
                }
                if (field === 'abstract') {
                    if (article.abstract) elem.textContent = article.abstract;
                    else elem.parentElement.style.display = 'none';
                }
                if (field === 'content') {
                    var contentHtml = article.content || '';
                    // 替换视频标签为打印占位符
                    if (contentHtml.indexOf('<video') !== -1) {
                        var videoPlaceholder = '<div class="media-print-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><polygon points="10 8 14 10 10 12 10 8"></polygon><line x1="2" y1="21" x2="22" y2="21"></line></svg><div class="media-print-placeholder-text">此处在原文中为视频资源，请扫描电子版查看详细内容</div></div>';
                        contentHtml = contentHtml.replace(/<video[^>]*>([\\s\\S]*?)<\\/video>/gi, videoPlaceholder);
                    }
                    elem.innerHTML = contentHtml;
                    if (article.fontSize) elem.style.fontSize = article.fontSize + 'px';
                    if (article.lineHeight) elem.style.lineHeight = article.lineHeight;
                }
                if (field === 'logo') {
                    var imgElem = elem.tagName === 'IMG' ? elem : elem.querySelector('img');
                    if (imgElem) { if (LOGO) imgElem.src = LOGO; else imgElem.style.display = 'none'; }
                }
                if (field === 'pdf-viewer' && article.pdfData) {
                    elem.style.display = 'block';
                    var pdfUrl = this.base64ToBlobUrl(article.pdfData);
                    if (pdfUrl) {
                        var obj = elem.querySelector('[data-field="pdf-object"]');
                        if (obj) obj.data = pdfUrl;
                        forEach(elem.querySelectorAll('[data-field="pdf-link"]'), function(l) { l.href = pdfUrl; });
                    }
                }
            }.bind(this));
            el.appendChild(node);
        },

        scrollToArticle: function(index) {
            this.currentIndex = index;
            forEach(document.querySelectorAll('.nav-item'), function(el, i) {
                if (i === index) el.classList.add('active'); else el.classList.remove('active');
            });
            forEach(document.querySelectorAll('.article-wrapper'), function(el, i) {
                if (i === index) el.classList.add('active'); else el.classList.remove('active');
            });
            var mainEl = document.getElementById('main');
            if (mainEl) mainEl.scrollTop = 0;
            
            var article = this.data[index];
            var isSpecial = article.category === '封面' || article.category === '封底';
            var currentWrapper = document.getElementById('article-' + index);
            var navMount = currentWrapper ? currentWrapper.querySelector('.article-navigation-mount') : null;
            
            if (isSpecial || !navMount) { if (navMount) navMount.innerHTML = ''; }
            else {
                var prevArt = index > 0 ? this.data[index - 1] : null;
                var nextArt = index < this.data.length - 1 ? this.data[index + 1] : null;
                var svgArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; transition:transform 0.3s;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
                var svgPrevArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; transform:rotate(180deg); transition:transform 0.3s;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

                navMount.innerHTML = '<div class="bottom-nav">' +
                    '<a class="nav-link ' + (!prevArt ? 'disabled' : '') + '" onclick="' + (prevArt ? 'app.prev()' : '') + '">' +
                        '<div class="nav-card">' + '<div class="nav-card-label">' + svgPrevArrow + ' 上一篇</div>' +
                            '<div class="nav-card-title">' + (prevArt ? escapeForJS(prevArt.title) : '已是第一篇') + '</div>' + '</div>' + '</a>' +
                    '<a class="nav-link next ' + (!nextArt ? 'disabled' : '') + '" onclick="' + (nextArt ? 'app.next()' : '') + '">' +
                        '<div class="nav-card next">' + '<div class="nav-card-label">下一篇 ' + svgArrow + '</div>' +
                            '<div class="nav-card-title">' + (nextArt ? escapeForJS(nextArt.title) : '已是最后一篇') + '</div>' + '</div>' + '</a>' + '</div>';
            }
            var sidebar = document.getElementById('sidebar');
            if (isSpecial) sidebar.classList.add('hidden'); else sidebar.classList.remove('hidden');
        },

        updateView: function(index) { this.scrollToArticle(index); },
        next: function() { if (this.data.length) this.scrollToArticle((this.currentIndex + 1) % this.data.length); },
        prev: function() { if (this.data.length) this.scrollToArticle((this.currentIndex - 1 + this.data.length) % this.data.length); },
        togglePdfExpand: function(btn) {
            var container = findParent(btn, 'pdf-viewer-container');
            if (!container) return;
            var isExpanded = container.classList.contains('expanded');
            var btnText = container.querySelector('.icon-expand') || btn.querySelector('.icon-expand');
            if (!isExpanded) {
                var placeholder = document.createElement('div');
                placeholder.className = 'pdf-viewer-placeholder';
                placeholder.style.display = 'none';
                container.parentNode.insertBefore(placeholder, container);
                document.body.appendChild(container);
                void container.offsetWidth;
                container.classList.add('expanded');
                container._placeholder = placeholder;
                if (btnText) btnText.textContent = '✕ 退出全屏';
                document.body.style.overflow = 'hidden';
            } else {
                var placeholder = container._placeholder;
                container.classList.remove('expanded');
                if (placeholder && placeholder.parentNode) {
                   placeholder.parentNode.insertBefore(container, placeholder);
                   placeholder.parentNode.removeChild(placeholder);
                }
                if (btnText) btnText.textContent = '⛶ 全屏阅读';
                document.body.style.overflow = '';
                delete container._placeholder;
            }
        }
    };
    window.app = app;
    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement) {
            document.body.classList.remove('immersive-mode');
            var sb = document.getElementById('sidebar');
            if (sb) sb.classList.remove('hidden');
        }
    });
    document.addEventListener('DOMContentLoaded', function() { app.init(); });
    
    // 接收来自知识图谱的溯源检索信号 (离线无网状态下原生工作)
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'GRAPH_SEARCH_KEYWORD') {
            var keyword = event.data.keyword;
            // 调用浏览器原生高亮与自动滚动
            var found = window.find(keyword, false, false, true, false, false, false);
            if (!found) {
                window.find(keyword, false, true, true, false, false, false);
            }
        }
    });
`;
}

export function getReaderTemplates() {
    return `
    <template id="tpl-magazine-cover">
        <div class="magazine-cover">
            <div class="magazine-bg-gradient"></div>
            <div class="magazine-header">
                <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                <div class="magazine-header-divider"></div>
                <div class="relative">
                    <svg class="magazine-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:400px;">
                        <defs><linearGradient id="magazineTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596; stop-opacity:1" /><stop offset="100%" style="stop-color:#003366; stop-opacity:1" /></linearGradient></defs>
                        <text x="50%" y="85" text-anchor="middle" font-family="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" font-weight="bold" font-size="90" fill="url(#magazineTitleGradientExport)" letter-spacing="15">工法情报</text>
                    </svg>
                    <div class="magazine-title-underline"></div>
                </div>
                <div class="magazine-meta-container">
                    <div class="magazine-meta-badge" data-field="issueText">NO.01</div>
                    <span style="color:#00559680; font-size:12px;">•</span>
                    <div class="magazine-meta-badge" data-field="dateText">JAN 2025</div>
                </div>
            </div>
            <div class="magazine-image-container"><div class="magazine-image-wrapper"><div class="magazine-image-placeholder" style="height:200px; display:flex; align-items:center; justify-content:center; color:#999; border:2px dashed #ddd; border-radius:10px;">暂无封面图片</div></div></div>
            <div class="magazine-footer"><div class="magazine-footer-text">OFFICIAL PUBLICATION</div><div class="magazine-button">开始阅读 <svg style="display:inline-block; vertical-align:middle; margin-left:6px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div></div>
        </div>
    </template>

    <template id="tpl-normal-cover">
        <div class="cover-root">
            <div class="tech-grid"></div><div class="ambient-bg"></div>
            <div class="cover-header">
                <div class="cover-sub">Ship Construction Method Information</div>
                <svg class="cover-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:320px;">
                    <defs><linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596"/><stop offset="100%" style="stop-color:#003366"/></linearGradient></defs>
                    <text x="50%" y="85" text-anchor="middle" fill="url(#g1)" font-family="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" font-weight="bold" font-size="90" letter-spacing="15">工法情报</text>
                </svg>
                <div class="cover-meta"><span data-field="issueText">NO.01</span> <span style="color:#666; font-size:12px;">·</span> <span data-field="dateText">JAN 2025</span></div>
            </div>
            <div class="cover-img-box"><div class="cover-img-placeholder">暂无封面图片</div></div>
            <div class="cover-footer"><div style="height:15px;width:80px;background-image:repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px);opacity:0.4;"></div><div class="magazine-button">开始阅读 <svg style="display:inline-block; vertical-align:middle; margin-left:6px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div></div>
        </div>
    </template>

    <template id="tpl-magazine-back">
        <div class="magazine-back-cover">
            <div class="magazine-back-bg" style="background: linear-gradient(to top left, rgba(235,248,255,0.8), white, rgba(243,244,246,0.8));"></div>
            <div class="magazine-back-header">
                <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                <div class="magazine-header-divider"></div>
                <div style="position: relative; transform: rotate(-2deg); transform-origin: left; display: inline-block;">
                    <div class="magazine-back-title">Sailing With Success</div>
                    <div class="magazine-back-title-underline"></div>
                </div>
            </div>
            <div class="magazine-back-image-container"><div class="magazine-image-placeholder" style="width:80%; height:80%; display:flex; align-items:center; justify-content:center; color:#999; border:2px dashed #ddd; border-radius:10px;">暂无封底图片</div></div>
            <div class="magazine-back-footer">
                <div class="magazine-back-left">
                    <div class="magazine-back-company">SWS OFFSHORE</div>
                    <div class="magazine-back-address">Shanghai Waigaoqiao Shipbuilding Co., Ltd.<br/>上海外高桥造船有限公司</div>
                    <div class="magazine-back-copyright">© 2025 Ship Construction Method Information</div>
                </div>
                <div class="magazine-back-center">
                    <div class="magazine-back-team">
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">编辑</div><b>马李琛</b></div>
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">校对</div><b>胡国超</b></div>
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">审核</div><b>储年生</b></div>
                    </div>
                    <div class="magazine-back-barcode"><div class="magazine-back-barcode-line"></div><div class="magazine-back-barcode-text">ISSN 0000-0000</div></div>
                </div>
                <div class="magazine-back-right"><img data-field="logo" class="magazine-back-logo" alt="Logo" /><div class="magazine-back-info">Official Publication<br/>Volume <span data-field="issueText">01</span> · <span data-field="dateText">JAN 2025</span></div></div>
            </div>
        </div>
    </template>

    <template id="tpl-normal-back">
        <div class="normal-back-root">
            <div class="tech-grid"></div><div class="ambient-bg" data-field="bgStyle"></div>
            <div class="normal-back-header"><div class="normal-back-sub">Ship Construction Method Information</div><h1 class="normal-back-title">Sailing With Success</h1></div>
            <div class="cover-img-box" style="flex-grow:1; min-height:500px;"><div class="cover-img-placeholder">暂无封底图片</div></div>
            <div class="normal-back-footer">
                <div class="normal-back-left">
                    <div class="normal-back-company-short">SWS OFFSHORE</div>
                    <div class="normal-back-company-full"><span>Shanghai Waigaoqiao Shipbuilding Co., Ltd.</span></div>
                </div>
                <div class="normal-back-right">
                    <div class="normal-back-bottom-meta">
                        <div class="flex gap-[4px] whitespace-nowrap"><span>编辑:</span> <b>马李琛</b></div>
                        <div class="flex gap-[4px] whitespace-nowrap"><span>校对:</span> <b>胡国超</b></div>
                        <div class="flex gap-[4px] whitespace-nowrap"><span>审核:</span> <b>储年生</b></div>
                    </div>
                    <img data-field="logo" class="normal-back-logo" style="height:20px; width:auto;" alt="Logo" />
                </div>
            </div>
        </div>
    </template>

    <template id="tpl-article">
        <div class="normal-container">
            <div class="article-header"><h1 data-field="title"></h1><div class="article-meta"><div class="tag-cloud" data-field="tags"></div><span data-field="category-label">分类: <span data-field="category"></span></span></div></div>
            <div class="summary-card"><div class="summary-label">摘要 / 导读</div><p data-field="abstract"></p></div>
            <div class="sws-prose article-body" data-field="content"></div>
            <div data-field="pdf-viewer" style="display: none;">
                <div class="pdf-viewer-container" data-id="pdf-container">
                    <div class="pdf-toolbar"><div class="pdf-toolbar-title">PDF PREVIEW</div><button class="pdf-expand-btn" onclick="app.togglePdfExpand(this)">⛶ 全屏阅读</button></div>
                    <div style="flex:1; width:100%; position:relative; background: #f3f4f6;"><object data-field="pdf-object" type="application/pdf" style="width: 100%; height: 100%;"><p>无法预览？请点击下方链接下载。</p></object><a data-field="pdf-link" target="_blank" rel="noreferrer" style="position: absolute; bottom: 15px; right: 25px; z-index: 9999; background: white; padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 4px; color: #005596; text-decoration: none; font-weight: bold;">点击打开PDF</a></div>
                </div>
            </div>
            
            <div class="article-navigation-mount"></div>
            
            <div class="article-footer-knowledge-base">
                <img data-field="logo" class="footer-logo" alt="" />
                SWS KNOWLEDGE BASE
            </div>
            <div class="article-end-mark">- End of Article -</div>
        </div>
    </template>
    `;
}

export function getReaderSkeleton(options: {
    sidebarMeta: string;
    logo: string;
    tocListHtml: string;
    articlesJson: string;
    configJson: string;
}) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>工法情报阅读器</title>
    <style>
        ${SHARED_STYLES}
        ${MAGAZINE_STYLES}
        ${PRINT_STYLES}
        ${MISC_STYLES}
        ${SEASONAL_STYLES}
    </style>
</head>
<body>
<!-- 【立即显示的Loading动画】在JavaScript执行前就可见 -->
<div id="app-loading" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#f8f9fa;display:flex;align-items:center;justify-content:center;z-index:99999;">
    <div style="text-align:center;">
        <div style="width:60px;height:60px;border:4px solid #e5e7eb;border-top-color:#005596;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px;"></div>
        <div style="color:#666;font-size:16px;font-family:sans-serif;">正在加载工法情报...</div>
        <div style="color:#999;font-size:12px;margin-top:8px;">文件较大，请稍候</div>
    </div>
</div>
<style>
@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>

<script>
// 【关键优化】优先加载数据，在任何UI渲染之前
window.__SWS_DATA_ARTICLES__ = ${options.articlesJson};
window.__SWS_DATA_CONFIG__ = ${options.configJson};
console.log('[Reader] 数据已就绪');
// 数据加载完成后立即隐藏loading
setTimeout(function() {
    var loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
}, 100);
</script>

<div id="app-root">
    <div id="top-controls">
        <button class="control-btn" onclick="app.toggleSidebar()" title="切换侧边栏"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="${SVG_ICONS.MENU}"/></svg></button>
        <button class="control-btn" onclick="app.toggleFullscreen()" title="全屏阅读"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="${SVG_ICONS.FULLSCREEN}"/></svg></button>
    </div>
    
    <div id="sidebar">
        <div class="sidebar-header">
            <svg class="sidebar-title-svg" viewBox="0 0 400 60" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:200px;">
                <defs><linearGradient id="sidebarTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596; stop-opacity:1" /><stop offset="100%" style="stop-color:#003366; stop-opacity:1" /></linearGradient></defs>
                <text x="50%" y="45" text-anchor="middle" font-family="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" font-weight="bold" font-size="48" fill="url(#sidebarTitleGradientExport)" letter-spacing="10">工法情报</text>
            </svg>
            <div class="sidebar-meta">${options.sidebarMeta}</div>
        </div>
        <div class="search-box"><input type="text" id="search-input" class="search-input" placeholder="搜索文章..." /></div>
        <ul id="article-list"></ul>
        <div class="sidebar-footer">${options.logo ? `<img src="${options.logo}" class="sidebar-logo" />` : ''}</div>
    </div>
    
    <div id="main">
        <div id="content-container">
            <div id="render-target"></div>
        </div>
    </div>
</div>

${getReaderTemplates()}

<script>
${getClientScript()}
</script>
</body>
</html>`;
}

export function getPrintableSkeleton(options: {
    contentHtml: string;
}) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>打印专用版 - 工法情报</title>
    <style>
        ${SHARED_STYLES}
        ${MAGAZINE_STYLES}
        ${PRINT_STYLES}
        ${MISC_STYLES}
        ${SEASONAL_STYLES}
        
        /* 强制覆盖部分可能干扰打印的样式 */
        body { 
            background: #525659; 
            margin: 0; 
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow-y: auto !important;
            height: auto !important;
        }

        .print-page-wrapper {
            background: white;
            width: 210mm;
            min-height: 297mm;
            margin-bottom: 30px;
            box-shadow: 0 0 15px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
            flex-shrink: 0;
        }
        /* 正文文章在预览中不强制297mm高度，避免底部白块 */
        .print-page-wrapper.article-wrapper {
            min-height: auto;
            overflow: visible;
        }
        

        @media print {
            /* 1. 绝对页面与边距重置 */
            @page {
                size: 210mm 297mm !important;
                margin: 0 !important;
            }
            html, body, .print-all {
                display: block !important;
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
            }

            /* 2. 基础页面容器设置 */
            .print-page-wrapper {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                page-break-before: always !important;
                break-before: page !important;
                overflow: visible !important;
            }
            .print-toolbar ~ .print-page-wrapper:first-of-type,
            body > .print-page-wrapper:first-child {
                page-break-before: auto !important;
                break-before: auto !important;
            }

            /* 3. 架构级降维打击：彻底解决 Chrome 幻影排版 (Phantom Pagination) */
            .normal-container,
            .article-wrapper,
            .sws-prose,
            .article-header,
            .article-body {
                display: block !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow: visible !important;
                position: static !important;
                visibility: visible !important;
                opacity: 1 !important;
                color: #000 !important;
            }
            
            /* 保护文章内容内部的所有元素 */
            .sws-prose > *,
            .article-body > * {
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            /* 确保内联文本元素正确显示 */
            .sws-prose p,
            .sws-prose span,
            .sws-prose strong,
            .sws-prose em,
            .sws-prose a,
            .sws-prose li {
                color: #000 !important;
            }
            
            /* 确保段落和列表项正确换行 */
            .sws-prose p {
                display: block !important;
                margin: 1em 0 !important;
            }
            
            .sws-prose li {
                display: list-item !important;
            }
            
            /* 特别修复：确保span、strong、em等内联元素保持内联显示 */
            .sws-prose span,
            .sws-prose strong,
            .sws-prose em,
            .sws-prose a {
                display: inline !important;
            }

            /* 3.5 宽幅重置：彻底打碎网页端 65ch 与 max-w 定宽约束，解决两侧大白边 */
            .normal-container,
            .sws-prose,
            .article-body,
            .article-header {
                width: 100% !important;
                max-width: none !important; 
                margin-left: 0 !important;
                margin-right: 0 !important;
                padding-left: 0 !important;
                padding-right: 0 !important;
                box-sizing: border-box !important;
            }
            
            /* 强制段落撑满并两端对齐，达到专业期刊排版效果 */
            .sws-prose p, 
            .sws-prose div {
                max-width: none !important;
                width: 100% !important;
                text-align: justify !important; 
            }

            /* 4. 各类页面的特定高度与边距规范 */
            .print-page-wrapper.article-wrapper,
            .print-page-wrapper.toc-page {
                padding: 15mm 20mm !important;
                height: auto !important;
                min-height: 0 !important;
            }
            .print-page-wrapper:not(.article-wrapper):not(.pdf-full-page) {
                min-height: 297mm !important;
            }
            
            /* 5. 目录页修复 */
            .print-page-wrapper.toc-page .toc-container {
                justify-content: flex-start !important;
                padding-top: 60px !important;
                overflow: visible !important;
                height: auto !important;
            }

            /* 6. PDF 专用页与图片强制填充 */
            .print-page-wrapper.pdf-full-page {
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: 100vh !important;
                max-height: 297mm !important;
                overflow: hidden !important;
            }
            .pdf-full-page img {
                display: block !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: fill !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
            }

            .no-print { display: none !important; }
        }

        /* 顶部提示工具条 */
        .print-toolbar {
            width: 210mm;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            margin-bottom: 20px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .print-toolbar-content {
            flex: 1;
        }
        .print-toolbar-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .print-toolbar-desc {
            font-size: 13px;
            opacity: 0.95;
            line-height: 1.6;
        }
        .print-btn-group {
            display: flex;
            gap: 12px;
            flex-direction: column;
        }
        .print-btn {
            background: white;
            color: #667eea;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            white-space: nowrap;
        }
        .print-btn:hover { 
            background: #f0f0f0; 
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .print-btn-secondary {
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 12px;
            padding: 6px 16px;
        }
        .print-btn-secondary:hover {
            background: rgba(255,255,255,0.3);
        }
    </style>
</head>
<body class="print-all">
    <div class="print-toolbar no-print">
        <div class="print-toolbar-content">
            <div class="print-toolbar-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                    <path d="M6 14h12v8H6z"/>
                </svg>
                打印专用预览模式
            </div>
            <div class="print-toolbar-desc">
                📄 <strong>导出为PDF</strong>：点击右侧按钮 → 在打印对话框中选择"另存为PDF"或"Microsoft Print to PDF"<br/>
                🖨️ <strong>直接打印</strong>：选择物理打印机并调整纸张设置为A4
            </div>
        </div>
        <div class="print-btn-group">
            <button class="print-btn" onclick="window.print()">
                📥 导出PDF / 打印
            </button>
            <button class="print-btn-secondary" onclick="window.print()">
                快捷键: Ctrl+P
            </button>
        </div>
    </div>

    ${options.contentHtml}

    <script>
        // 处理图片加载
        window.onload = function() {
            var imgs = document.getElementsByTagName('img');
            for (var i = 0; i < imgs.length; i++) {
                if (imgs[i].getAttribute('data-src')) {
                    imgs[i].src = imgs[i].getAttribute('data-src');
                }
            }
        };
    </script>
</body>
</html>`;
}
