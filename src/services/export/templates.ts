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


    // Blob 缓存系统 (LRU 实现)
    class BlobCache {
        constructor(maxSize = 9999) {
            this.maxSize = maxSize;
            this.cache = new Map();
        }
        
        get(key) {
            if (!this.cache.has(key)) return null;
            const entry = this.cache.get(key);
            entry.timestamp = Date.now();
            this.cache.set(key, entry);
            return entry.blobUrl;
        }
        
        set(key, blobUrl) {
            if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
                let oldestKey = null;
                let oldestTime = Infinity;
                for (const [k, v] of this.cache.entries()) {
                    if (v.timestamp < oldestTime) {
                        oldestTime = v.timestamp;
                        oldestKey = k;
                    }
                }
                if (oldestKey) {
                    URL.revokeObjectURL(this.cache.get(oldestKey).blobUrl);
                    this.cache.delete(oldestKey);
                }
            }
            this.cache.set(key, { blobUrl, timestamp: Date.now() });
        }
        
        has(key) { return this.cache.has(key); }
        
        delete(key) {
            if (!this.cache.has(key)) return false;
            URL.revokeObjectURL(this.cache.get(key).blobUrl);
            return this.cache.delete(key);
        }
        
        clear() {
            for (const entry of this.cache.values()) {
                URL.revokeObjectURL(entry.blobUrl);
            }
            this.cache.clear();
        }
    }

    var app = {
        data: Array.isArray(DATA) ? DATA : [],
        blobCache: new BlobCache(9999),
        currentIndex: 0,
        alternateDesign: CONFIG.alternateDesign || false,
        currentBlobUrls: [],

        base64ToBlobUrl: function(base64, type) {
            if (!base64) return null;
            
            // 统一处理前缀：确保 data URI 格式完整
            var dataUri = base64;
            if (base64.indexOf('data:') !== 0) {
                var mime = type === 'pdf' ? 'application/pdf' : (type === 'video' ? 'video/mp4' : 'image/png');
                dataUri = 'data:' + mime + ';base64,' + base64;
            }

            // --- 核心职责分离逻辑 ---
            // 只有 PDF 且在本地 file:// 协议下才允许降级为 Data URI 以绕过安全限制
            if (type === 'pdf' && window.location.protocol === 'file:') {
                return dataUri;
            }

            // 其他情况（图片、视频、或非本地环境下的 PDF）一律转换为 Blob URL
            try {
                var split = dataUri.split(',');
                var mimeType = split[0].match(/:(.*?);/)[1];
                var bin = atob(split[1]);
                var len = bin.length;
                var arr = new Uint8Array(len);
                for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
                var blob = new Blob([arr], { type: mimeType });
                var url = URL.createObjectURL(blob);
                this.currentBlobUrls.push(url);
                return url;
            } catch(e) {
                console.error("Blob conversion failed, falling back to Data URI", e);
                return dataUri;
            }
        },

        init: function() {
            try {
                // 【架构级标识】为阅读版硬编码注入环境特征类名
                // 此标识将激活 graphRenderer.ts 内部预设的纯 CSS 防御系统，从而彻底绕过危险的 iframe 渲染。
                document.body.classList.add('is-offline-reader');

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
            
            // 初始化懒加载观察器
            this.initLazyLoading();
            
            // 【架构师修正】：使用 setTimeout 将隐藏逻辑推迟到下一个事件循环
            // 确保浏览器已经完成了重排(Reflow)和重绘(Repaint)，保证过渡动画平滑执行
            setTimeout(function() {
                var loading = document.getElementById('app-loading');
                if (loading) {
                    loading.style.transition = 'opacity 0.4s ease';
                    loading.style.opacity = '0';
                    setTimeout(function() { loading.style.display = 'none'; }, 400);
                }
            }, 50); // 50ms 缓冲时间足够浏览器完成首屏 Paint
        },
        
        /**
         * 初始化懒加载观察器
         */
        initLazyLoading: function() {
            if (typeof IntersectionObserver === 'undefined') {
                console.warn('[Reader] IntersectionObserver 不支持，回退到立即加载所有媒体');
                this.loadAllMedia();
                return;
            }
            
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        var placeholder = entry.target;
                        var articleIndex = parseInt(placeholder.dataset.articleIndex);
                        var mediaIndex = parseInt(placeholder.dataset.mediaIndex);
                        var mediaType = placeholder.dataset.mediaType;
                        
                        // 防抖：使用 requestAnimationFrame 避免快速滚动的重复加载
                        requestAnimationFrame(function() {
                            app.loadMediaElement(placeholder, articleIndex, mediaIndex, mediaType);
                        });
                    }
                });
            }, {
                rootMargin: '100% 0px', // 预加载视口上下100%范围
                threshold: 0.1
            });
            
            // 为所有媒体占位符注册观察
            var placeholders = document.querySelectorAll('.media-lazy-placeholder');
            console.log('[Reader] 注册懒加载占位符:', placeholders.length);
            for (var i = 0; i < placeholders.length; i++) {
                observer.observe(placeholders[i]);
            }
            
            // 保存观察器实例以便后续清理
            this.mediaObserver = observer;
        },
        
        /**
         * 加载单个媒体元素
         */
        loadMediaElement: function(placeholder, articleIndex, mediaIndex, mediaType) {
            // 检查是否已加载
            if (placeholder.dataset.loaded === 'true') return;
            
            var article = this.data[articleIndex];
            if (!article) return;
            
            var cacheKey = 'article-' + articleIndex + '-' + mediaType + '-' + mediaIndex;
            var blobUrl = this.blobCache.get(cacheKey);
            
            if (!blobUrl) {
                // 需要从Base64创建Blob
                var src;
                
                // 【架构师修正】：暗号机制处理
                if (mediaType === 'iframe' && placeholder.dataset.src === 'pdf-placeholder') {
                    // 从暗号直接读取内存中的 PDF Base64 数据
                    src = article.pdfData;
                } else {
                    // 其他媒体从 dataset 读取
                    src = placeholder.dataset.src;
                }
                
                if (!src) return;
                
                // 无论源数据是否有 data: 前缀，都强制转换为轻量级的 Blob URL，将内存释放给底层 C++ 引擎
                if (src.startsWith('data:') || src.startsWith('base64,') || mediaType === 'iframe') {
                    blobUrl = this.base64ToBlobUrl(src, mediaType);
                } else {
                    // 只有普通 http(s):// 或相对路径 URL 才直接使用
                    blobUrl = src;
                }
                
                if (blobUrl && blobUrl !== src) {
                    // 缓存Blob URL
                    this.blobCache.set(cacheKey, blobUrl);
                }
            }
            
            // 根据媒体类型创建真实元素
            var mediaEl;
            if (mediaType === 'img') {
                mediaEl = document.createElement('img');
                mediaEl.src = blobUrl || placeholder.dataset.src;
                mediaEl.alt = placeholder.dataset.alt || '';
                // 恢复原始样式和类名
                if (placeholder.dataset.className) mediaEl.className = placeholder.dataset.className;
                if (placeholder.dataset.cssText) mediaEl.style.cssText = placeholder.dataset.cssText;
                // 原有的 width/height 赋值逻辑可以保留作为兜底
                if (placeholder.dataset.width) mediaEl.style.width = placeholder.dataset.width;
                if (placeholder.dataset.height) mediaEl.style.height = placeholder.dataset.height;
            } else if (mediaType === 'video') {
                mediaEl = document.createElement('video');
                mediaEl.src = blobUrl || placeholder.dataset.src;
                // 恢复原始样式和类名
                if (placeholder.dataset.className) mediaEl.className = placeholder.dataset.className;
                if (placeholder.dataset.cssText) mediaEl.style.cssText = placeholder.dataset.cssText;
                if (placeholder.dataset.poster) mediaEl.poster = placeholder.dataset.poster;
                mediaEl.controls = true;
                mediaEl.preload = 'metadata';
            } else if (mediaType === 'iframe') {
                mediaEl = document.createElement('iframe');
                // 恢复原始样式和类名
                if (placeholder.dataset.className) mediaEl.className = placeholder.dataset.className;
                if (placeholder.dataset.cssText) mediaEl.style.cssText = placeholder.dataset.cssText;
                
                // 添加 PDF 查看器参数
                var finalUrl = blobUrl || placeholder.dataset.src;
                if (finalUrl && !finalUrl.includes('#')) {
                    finalUrl += '#toolbar=0&navpanes=0';
                }
                mediaEl.src = finalUrl;
                
                mediaEl.style.width = '100%';
                mediaEl.style.height = '750px';
                mediaEl.style.border = 'none';
            }
            
            if (mediaEl) {
                // 设置加载完成后的回调
                mediaEl.onload = function() {
                    placeholder.dataset.loaded = 'true';
                };

                // 【架构师补丁】：停止观察即将被销毁的占位符，防止 Detached DOM 内存泄漏
                if (app.mediaObserver) {
                    app.mediaObserver.unobserve(placeholder);
                }

                // 替换占位符
                placeholder.parentNode.replaceChild(mediaEl, placeholder);
            }
        },
        
        /**
         * 立即加载所有媒体（回退方案）
         */
        loadAllMedia: function() {
            var placeholders = document.querySelectorAll('.media-lazy-placeholder');
            console.log('[Reader] 立即加载所有媒体:', placeholders.length);
            for (var i = 0; i < placeholders.length; i++) {
                var placeholder = placeholders[i];
                var articleIndex = parseInt(placeholder.dataset.articleIndex);
                var mediaIndex = parseInt(placeholder.dataset.mediaIndex);
                var mediaType = placeholder.dataset.mediaType;
                this.loadMediaElement(placeholder, articleIndex, mediaIndex, mediaType);
            }
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

            // 【架构级优化】：使用正则进行不区分大小写匹配，避免 toLowerCase() 导致的内存海啸
            // 提前编译好安全的正则表达式
            var searchRegex = null;
            if (term) {
                // 转义正则特殊字符，防止用户输入 [ 或者 * 导致正则崩溃
                var pattern = '[.*+?^\\$\\{\\}()|\\[\\]\\\\]';
                var safeTerm = term.replace(new RegExp(pattern, 'g'), '\\$&');
                searchRegex = new RegExp(safeTerm, 'i');
            }

            this.data.forEach(function(item, index) {
                if (searchRegex) {
                    var matchTitle = item.title && searchRegex.test(item.title);
                    var matchContent = item.content && searchRegex.test(item.content);
                    if (!matchTitle && !matchContent) return; // 未命中则跳过
                }

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
            console.log('[Reader] 开始渲染所有文章（模板渲染 + 后置懒加载拦截）');
            container.innerHTML = '';
            
            for (var i = 0; i < this.data.length; i++) {
                var article = this.data[i];
                var wrapper = document.createElement('div');
                wrapper.className = 'article-wrapper';
                wrapper.id = 'article-' + i;
                
                if (article.category === '封面') {
                    this.renderCover(wrapper, article);
                } else if (article.category === '封底') {
                    this.renderBack(wrapper, article);
                } else {
                    // 1. 先用原生 renderNormal 生成完整模板 (包含标签、底部导航、PDF附件容器等)
                    this.renderNormal(wrapper, article);
                    
                    // 2. 【架构师修正】：精确组合选择器！
                    // 仅拦截正文(.article-body)内部的图/视频，以及外挂的 PDF iframe。绝对不误伤外层的 Footer Logo！
                    var mediaElements = wrapper.querySelectorAll('.article-body img, .article-body video, iframe[data-pdf-src]');
                    
                    for (var j = 0; j < mediaElements.length; j++) {
                        var mediaEl = mediaElements[j];
                        var placeholder = document.createElement('div');
                        placeholder.className = 'media-lazy-placeholder';
                        placeholder.dataset.articleIndex = i;
                        placeholder.dataset.mediaIndex = j;
                        
                        var mediaType = mediaEl.tagName.toLowerCase();
                        placeholder.dataset.mediaType = mediaType;
                        
                        // 继承原始样式和类名
                        placeholder.dataset.className = mediaEl.className || '';
                        placeholder.dataset.cssText = mediaEl.style.cssText || '';
                        
                        if (mediaType === 'img') {
                            // 优先读取从 renderNormal 存入的 data-src 属性
                            placeholder.dataset.src = mediaEl.getAttribute('data-src') || mediaEl.src || '';
                            placeholder.dataset.alt = mediaEl.alt || '';
                            if (mediaEl.style.width) placeholder.style.width = mediaEl.style.width;
                            if (mediaEl.style.height) placeholder.style.height = mediaEl.style.height;
                        } else if (mediaType === 'video') {
                            // 优先读取从 renderNormal 存入的 data-src 属性
                            placeholder.dataset.src = mediaEl.getAttribute('data-src') || mediaEl.src || '';
                            placeholder.dataset.poster = mediaEl.poster || '';
                        } else if (mediaType === 'iframe') {
                            // PDF 专有处理 - 设置接头暗号
                            placeholder.dataset.src = 'pdf-placeholder';
                        }
                        
                        placeholder.style.display = 'inline-block';
                        placeholder.style.backgroundColor = '#f3f4f6';
                        placeholder.style.borderRadius = '4px';
                        placeholder.style.minWidth = '100px';
                        placeholder.style.minHeight = '100px';
                        placeholder.style.textAlign = 'center';
                        placeholder.style.lineHeight = '100px';
                        placeholder.style.color = '#9ca3af';
                        placeholder.innerHTML = '[' + mediaType.toUpperCase() + ' 加载中...]';
                        
                        mediaEl.parentNode.replaceChild(placeholder, mediaEl);
                    }
                }
                container.appendChild(wrapper);
            }
            
            console.log('[Reader] 文章渲染完成，共', this.data.length, '篇');
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
            var coverImgUrl = this.base64ToBlobUrl(article.coverImage, 'img');
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
            var backImgUrl = this.base64ToBlobUrl(article.backImage, 'img');

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
                    // 创建 template 惰性隔离层
                    var temp = document.createElement('template');
                    temp.innerHTML = article.content || '';
                    
                    // 剥夺所有媒体的 src 属性，彻底阻断浏览器的饥渴加载
                    var imgs = temp.content.querySelectorAll('img');
                    for(var k=0; k<imgs.length; k++) {
                        if (imgs[k].getAttribute('src')) {
                            imgs[k].setAttribute('data-src', imgs[k].getAttribute('src'));
                            imgs[k].removeAttribute('src');
                        }
                    }
                    var vids = temp.content.querySelectorAll('video');
                    for(var k=0; k<vids.length; k++) {
                        if (vids[k].getAttribute('src')) {
                            vids[k].setAttribute('data-src', vids[k].getAttribute('src'));
                            vids[k].removeAttribute('src');
                        }
                    }
                    
                    elem.appendChild(temp.content);
                    if (article.fontSize) elem.style.fontSize = article.fontSize + 'px';
                    if (article.lineHeight) elem.style.lineHeight = article.lineHeight;
                }
                if (field === 'logo') {
                    var imgElem = elem.tagName === 'IMG' ? elem : elem.querySelector('img');
                    if (imgElem) { if (LOGO) imgElem.src = LOGO; else imgElem.style.display = 'none'; }
                }
                if (field === 'pdf-viewer' && article.pdfData) {
                    elem.style.display = 'block';
                    var iframe = elem.querySelector('[data-field="pdf-iframe"]');
                    if (iframe) {
                        // 设置占位暗号，禁止立即调用 base64ToBlobUrl
                        iframe.setAttribute('data-pdf-src', 'pending-lazy-load');
                    }
                    
                    var dlBtn = elem.querySelector('[data-field="pdf-download-btn"]');
                    if (dlBtn) {
                        var self = this;
                        dlBtn.onclick = function(e) {
                            e.preventDefault();
                            try {
                                // 点击时才在内存中临时生成 Blob
                                var pdfUrl = self.base64ToBlobUrl(article.pdfData, 'pdf');
                                var link = document.createElement('a');
                                link.href = pdfUrl;
                                link.download = (article.title || 'document') + '.pdf';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            } catch(err) { alert('下载失败，请重试'); }
                        };
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
            if (!isExpanded) {
                var placeholder = document.createElement('div');
                placeholder.className = 'pdf-viewer-placeholder';
                placeholder.style.height = container.offsetHeight + 'px';
                container.parentNode.insertBefore(placeholder, container);
                document.body.appendChild(container);
                container.classList.add('expanded');
                container._placeholder = placeholder;
                btn.textContent = '✕ 退出全屏';
                document.body.style.overflow = 'hidden';
            } else {
                var placeholder = container._placeholder;
                container.classList.remove('expanded');
                if (placeholder && placeholder.parentNode) {
                   placeholder.parentNode.insertBefore(container, placeholder);
                   placeholder.parentNode.removeChild(placeholder);
                }
                btn.textContent = '⛶ 全屏阅读';
                document.body.style.overflow = '';
                delete container._placeholder;
            }
        },
        toggleGraphExpand: function(btn) {
            var container = findParent(btn, 'knowledge-graph-container');
            if (!container) return;
            var isExpanded = container.classList.contains('graph-expanded');
            var iframe = container.querySelector('iframe');
            if (!isExpanded) {
                var placeholder = document.createElement('div');
                placeholder.className = 'graph-expand-placeholder';
                placeholder.style.height = container.offsetHeight + 'px';
                container.parentNode.insertBefore(placeholder, container);
                document.body.appendChild(container);
                container.classList.add('graph-expanded');
                container._placeholder = placeholder;
                btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg> 退出全屏';
                document.body.style.overflow = 'hidden';
                if (iframe) iframe.style.height = 'calc(100vh - 60px)';
            } else {
                var placeholder = container._placeholder;
                container.classList.remove('graph-expanded');
                if (placeholder && placeholder.parentNode) {
                   placeholder.parentNode.insertBefore(container, placeholder);
                   placeholder.parentNode.removeChild(placeholder);
                }
                btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg> 全屏查看';
                document.body.style.overflow = '';
                if (iframe) iframe.style.height = '750px';
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
    
    // 接收来自知识图谱的消息
    window.addEventListener('message', function(event) {
        if (!event.data) return;
        
        // 1. 溯源检索信号 (离线无网状态下原生工作)
        if (event.data.type === 'GRAPH_SEARCH_KEYWORD') {
            var keyword = event.data.keyword;
            // 调用浏览器原生高亮与自动滚动
            var found = window.find(keyword, false, false, true, false, false, false);
            if (!found) {
                window.find(keyword, false, true, true, false, false, false);
            }
        }
        
        // 2. 数据请求信号 (针对 Iframe 无法主动访问 parent 时的握手回流)
        if (event.data.type === 'GRAPH_REQUEST_DATA' && event.data.uid) {
            var uid = event.data.uid;
            var el = document.getElementById('data-' + uid);
            if (el) {
                var f = document.getElementById('iframe-' + uid);
                // 直接发送 Base64 字符串以节省主线程 JSON 解析开销
                if (f && f.contentWindow) {
                    f.contentWindow.postMessage({ 
                      type: 'GRAPH_DATA_RESPONSE', 
                      uid: uid, 
                      dataB64: el.textContent 
                    }, '*');
                }
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
                    <div style="flex:1; width:100%; position:relative; background: #f3f4f6;"><iframe data-field="pdf-iframe" style="width: 100%; height: 100%; border: none;"></iframe>
<button data-field="pdf-download-btn" style="position: absolute; bottom: 15px; right: 25px; z-index: 9999; background: white; padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 4px; color: #005596; text-decoration: none; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">下载完整 PDF</button></div>
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
        <div class="progress-text" style="color:#666;font-size:16px;font-family:sans-serif;">正在解压核心资产...</div>
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
window.__SWS_DATA_ARTICLES_B64__ = "${options.articlesJson}";
window.__SWS_DATA_CONFIG_B64__ = "${options.configJson}";
window.__SWS_COMPRESSION_METHOD__ = "gzip";

// 【性能优化】流式解压核心资产，显示实时进度
(async function() {
    const progressEl = document.querySelector('.progress-text');
    
    function updateProgress(percent, message) {
        if (progressEl) {
            progressEl.textContent = message || '正在解压核心资产 ' + percent + '%...';
        }
    }
    
    try {
        console.log('[Reader] 开始流式解压核心资产...');
        updateProgress(0, '正在解压核心资产...');
        
        // 检查压缩方法，如果未定义则假定为旧格式（未压缩）
        const compressionMethod = window.__SWS_COMPRESSION_METHOD__ || 'none';
        
        if (compressionMethod === 'none') {
            // 向后兼容：旧格式数据（未压缩）
            console.log('[Reader] 检测到旧格式数据（未压缩）');
            window.__SWS_DATA_ARTICLES__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_ARTICLES_B64__))));
            window.__SWS_DATA_CONFIG__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_CONFIG_B64__))));
            updateProgress(100, '数据加载完成');
        } else {
            // 新格式：使用 fetch + DecompressionStream 异步解压
            updateProgress(0, '正在初始化解压引擎...');
            
            // 解压文章数据
            const articlesData = await decompressWithProgress(
                window.__SWS_DATA_ARTICLES_B64__, 
                compressionMethod,
                (percent) => updateProgress(percent, '正在解压核心资产 ' + percent + '%...')
            );
            window.__SWS_DATA_ARTICLES__ = JSON.parse(articlesData);
            
            // 解压配置数据
            const configData = await decompressWithProgress(
                window.__SWS_DATA_CONFIG_B64__,
                compressionMethod,
                (percent) => updateProgress(percent, '正在解压配置数据 ' + percent + '%...')
            );
            window.__SWS_DATA_CONFIG__ = JSON.parse(configData);
        }
        
        console.log('[Reader] 数据已成功载入并就绪', window.__SWS_DATA_ARTICLES__.length);
        updateProgress(100, '数据加载完成');
        

        
    } catch(e) {
        console.error('[Reader] 数据解压失败:', e);
        updateProgress(0, '数据解压失败，尝试回退方案...');
        
        // 尝试回退到旧格式
        try {
            window.__SWS_DATA_ARTICLES__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_ARTICLES_B64__))));
            window.__SWS_DATA_CONFIG__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_CONFIG_B64__))));
            console.log('[Reader] 回退方案成功，数据已加载');
        } catch(fallbackError) {
            console.error('[Reader] 回退方案也失败:', fallbackError);
            window.__SWS_DATA_ARTICLES__ = [];
            window.__SWS_DATA_CONFIG__ = {};
        }
        
        // 隐藏loading
        const loading = document.getElementById('app-loading');
        if (loading) loading.style.display = 'none';
    }
})();

/**
 * 流式解压带进度回调（使用 fetch 异步解码 Base64，避免主线程阻塞）
 */
async function decompressWithProgress(compressedB64, method, progressCallback) {
    // 使用 fetch + Data URI 异步解码 Base64，避免 atob() 阻塞主线程
    const dataUri = "data:application/octet-stream;base64," + compressedB64;
    const response = await fetch(dataUri); // 底层网络线程异步解码
    
    const totalSize = parseInt(response.headers.get('content-length') || '0') || Math.floor(compressedB64.length * 0.75);
    let processedSize = 0;
    
    // 创建进度追踪的 TransformStream
    const progressStream = new TransformStream({
        transform(chunk, controller) {
            processedSize += chunk.byteLength || chunk.length;
            const percent = Math.round((processedSize / totalSize) * 100);
            if (progressCallback) progressCallback(percent);
            controller.enqueue(chunk);
        }
    });
    
    // 流式解压管道
    const decompressionStream = new DecompressionStream(method);
    const pipeResult = response.body
        .pipeThrough(decompressionStream)
        .pipeThrough(progressStream);
    
    // 读取解压后的数据
    const reader = pipeResult.getReader();
    const chunks = [];
    let decompressedSize = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value instanceof Uint8Array) {
            chunks.push(value);
            decompressedSize += value.length;
        }
    }
    
    // 合并所有块
    const result = new Uint8Array(decompressedSize);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    
    if (progressCallback) progressCallback(100);
    return new TextDecoder().decode(result);
}
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
