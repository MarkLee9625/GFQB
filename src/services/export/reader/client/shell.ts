/**
 * 离线阅读器客户端脚本 - 应用外壳片段（app 字段/init 初始化/导航/全屏切换）
 *
 * 约束：返回的 ES5 代码字符串内严禁出现反引号与 ${}。
 * HEAD 为 `var app = {` 开头（含字段与 init），TAIL 收尾（含导航方法与 `};` 及 window 挂载），
 * 中间由 media/render 方法片段填充，全部由 clientScript 按序组装。
 */

export function getClientShellHeadCode(): string {
    return `
    var app = {
        data: [],
        blobCache: null,
        currentIndex: 0,
        alternateDesign: false,
        mediaObserver: null,

        init: function() {
            try {
                document.body.classList.add('is-offline-reader');

                this.data = Array.isArray(window.__SWS_DATA_ARTICLES__) ? window.__SWS_DATA_ARTICLES__ : [];
                var newConfig = window.__SWS_DATA_CONFIG__ || {};
                var LOGO = newConfig.logo || "";
                window._SWS_LOGO = LOGO;
                var APP_COMPANY = newConfig.company || {};
                if (newConfig.alternateDesign !== undefined) this.alternateDesign = newConfig.alternateDesign;

                console.log('[Reader] App init, data length:', this.data.length);

                if (this.data.length === 0) {
                    console.error('[Reader] WARNING: No article data!');
                    if (window.__SWS_DATA_ARTICLES_B64__) {
                        try {
                            this.data = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_ARTICLES_B64__))));
                            console.log('[Reader] Fallback parse succeeded, length:', this.data.length);
                        } catch(e) {
                            console.error('[Reader] Fallback parse failed:', e);
                        }
                    }
                }

                try {
                    this.renderAll();
                    console.log('[Reader] renderAll() done');
                } catch (renderErr) {
                    console.error('[Reader] renderAll() failed:', renderErr);
                }

                try {
                    this.updateView(0);
                    console.log('[Reader] First view updated');
                } catch (viewErr) {
                    console.error('[Reader] updateView(0) failed:', viewErr);
                }

                var self = this;
                setTimeout(function() {
                    self.renderList();
                    console.log('[Reader] Sidebar list rendered');
                }, 100);

                var searchInput = document.getElementById('search-input');
                if (searchInput) {
                    var searchDebounce = null;
                    searchInput.addEventListener('input', function(e) {
                        clearTimeout(searchDebounce);
                        var term = e.target.value.toLowerCase();
                        searchDebounce = setTimeout(function() { self.renderList(term); }, 300);
                    });
                }

                document.addEventListener('keydown', function(e) {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
                    switch(e.key) {
                        case 'ArrowRight': case 'PageDown': case 'n': case 'N':
                            self.next(); e.preventDefault(); break;
                        case 'ArrowLeft': case 'PageUp': case 'p': case 'P':
                            self.prev(); e.preventDefault(); break;
                        case 'Home': self.scrollToArticle(0); e.preventDefault(); break;
                        case 'End': self.scrollToArticle(self.data.length - 1); e.preventDefault(); break;
                    }
                });
            } catch (err) {
                console.error("App init error", err);
            }

            try {
                this.initLazyLoading();
            } catch (err) {
                console.error('[Reader] initLazyLoading error:', err);
                try { this.loadAllMedia(); } catch (e) { console.error('[Reader] loadAllMedia failed:', e); }
            }

            var self = this;
            setTimeout(function() {
                var loading = document.getElementById('app-loading');
                if (loading) {
                    loading.style.transition = 'opacity 0.4s ease';
                    loading.style.opacity = '0';
                    setTimeout(function() { loading.style.display = 'none'; }, 400);
                }
            }, 50);
        },
`;
}

export function getClientShellTailCode(): string {
    return `
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
        scrollToArticle: function(index) {
            this.currentIndex = index;
            var self = this;
            forEach(document.querySelectorAll('.nav-item'), function(el, i) {
                if (i === index) el.classList.add('active'); else el.classList.remove('active');
            });
            forEach(document.querySelectorAll('.article-wrapper'), function(el, i) {
                if (i === index) el.classList.add('active'); else el.classList.remove('active');
            });
            var mainEl = document.getElementById('main');
            if (mainEl) mainEl.scrollTop = 0;

            var article = this.data[index];
            if (!article) return;
            var isSpecial = article.category === '封面' || article.category === '封底';
            var currentWrapper = document.getElementById('article-' + index);
            var navMount = currentWrapper ? currentWrapper.querySelector('.article-navigation-mount') : null;

            if (isSpecial || !navMount) { if (navMount) navMount.innerHTML = ''; }
            else {
                var prevArt = index > 0 ? this.data[index - 1] : null;
                var nextArt = index < this.data.length - 1 ? this.data[index + 1] : null;
                var svgArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
                var svgPrevArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; transform:rotate(180deg);"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
                navMount.innerHTML = '<div class="bottom-nav">' +
                    '<a class="nav-link ' + (!prevArt ? 'disabled' : '') + '" onclick="' + (prevArt ? 'app.prev()' : '') + '">' +
                        '<div class="nav-card"><div class="nav-card-label">' + svgPrevArrow + ' 上一篇</div>' +
                            '<div class="nav-card-title">' + (prevArt ? escapeForJS(prevArt.title) : '已是第一篇') + '</div></div></a>' +
                    '<a class="nav-link next ' + (!nextArt ? 'disabled' : '') + '" onclick="' + (nextArt ? 'app.next()' : '') + '">' +
                        '<div class="nav-card next"><div class="nav-card-label">下一篇 ' + svgArrow + '</div>' +
                            '<div class="nav-card-title">' + (nextArt ? escapeForJS(nextArt.title) : '已是最后一篇') + '</div></div></a></div>';
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
                btn.textContent = '退出全屏';
                document.body.style.overflow = 'hidden';
            } else {
                var placeholder = container._placeholder;
                container.classList.remove('expanded');
                if (placeholder && placeholder.parentNode) {
                   placeholder.parentNode.insertBefore(container, placeholder);
                   placeholder.parentNode.removeChild(placeholder);
                }
                btn.textContent = '⛶全屏阅读';
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
                btn.textContent = 'Exit Fullscreen';
                document.body.style.overflow = 'hidden';
                if (iframe) iframe.style.height = 'calc(100vh - 60px)';
            } else {
                var placeholder = container._placeholder;
                container.classList.remove('graph-expanded');
                if (placeholder && placeholder.parentNode) {
                   placeholder.parentNode.insertBefore(container, placeholder);
                   placeholder.parentNode.removeChild(placeholder);
                }
                btn.textContent = 'Fullscreen';
                document.body.style.overflow = '';
                if (iframe) iframe.style.height = '750px';
                delete container._placeholder;
            }
        }
    };

    window.app = app;
    window._SWS_LOGO = "";
`;
}
