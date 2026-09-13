/**
 * 离线阅读器客户端脚本 - 媒体懒加载片段（base64→Blob、IntersectionObserver、img/video/iframe 占位替换）
 *
 * 约束：返回的 ES5 代码字符串内严禁出现反引号与 ${}。
 * 各片段为 `var app = {...}` 对象字面量的方法定义，依赖运行时 `this`，由 clientScript 组装。
 */

export function getClientMediaMethodsCode(): string {
    return `
        base64ToBlobUrl: function(base64, type) {
            if (!base64) return null;
            var dataUri = base64;
            if (base64.indexOf('data:') !== 0) {
                var mime = type === 'pdf' ? 'application/pdf' : (type === 'video' ? 'video/mp4' : 'image/png');
                dataUri = 'data:' + mime + ';base64,' + base64;
            }
            if (type === 'pdf' && window.location.protocol === 'file:') {
                return dataUri;
            }
            try {
                var commaIdx = dataUri.indexOf(',');
                if (commaIdx === -1) return dataUri;
                var headerPart = dataUri.substring(0, commaIdx);
                var base64Part = dataUri.substring(commaIdx + 1);
                var mimeMatch = headerPart.match(/:(.*?);/);
                if (!mimeMatch) return dataUri;
                var mimeType = mimeMatch[1];
                var bin = atob(base64Part);
                var len = bin.length;
                var arr = new Uint8Array(len);
                for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
                var blob = new Blob([arr], { type: mimeType });
                return URL.createObjectURL(blob);
            } catch(e) {
                console.error("[Reader] Blob conversion failed", e);
                return dataUri;
            }
        },
        initLazyLoading: function() {
            if (typeof IntersectionObserver === 'undefined') {
                this.loadAllMedia();
                return;
            }
            var self = this;
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        var placeholder = entry.target;
                        var articleIndex = parseInt(placeholder.dataset.articleIndex);
                        var mediaIndex = parseInt(placeholder.dataset.mediaIndex);
                        var mediaType = placeholder.dataset.mediaType;
                        requestAnimationFrame(function() {
                            self.loadMediaElement(placeholder, articleIndex, mediaIndex, mediaType);
                        });
                    }
                });
            }, { rootMargin: '100% 0px', threshold: 0.1 });

            var placeholders = document.querySelectorAll('.media-lazy-placeholder');
            console.log('[Reader] Lazy loading placeholders:', placeholders.length);
            for (var i = 0; i < placeholders.length; i++) {
                observer.observe(placeholders[i]);
            }
            this.mediaObserver = observer;
        },
        loadMediaElement: function(placeholder, articleIndex, mediaIndex, mediaType) {
            if (placeholder.dataset.loaded === 'true') return;
            var article = this.data[articleIndex];
            if (!article) return;
            var cacheKey = 'article-' + articleIndex + '-' + mediaType + '-' + mediaIndex;
            var blobUrl = null;
            if (this.blobCache && this.blobCache.get) blobUrl = this.blobCache.get(cacheKey);

            if (!blobUrl) {
                var src;
                if (mediaType === 'iframe' && placeholder.dataset.src === 'pdf-placeholder') {
                    src = article.pdfData;
                } else {
                    src = placeholder.dataset.src;
                }
                if (!src) return;
                if (src.startsWith('data:') || src.startsWith('base64,') || mediaType === 'iframe') {
                    blobUrl = this.base64ToBlobUrl(src, mediaType);
                } else {
                    blobUrl = src;
                }
                if (blobUrl && blobUrl !== src && this.blobCache && this.blobCache.set) {
                    this.blobCache.set(cacheKey, blobUrl);
                }
            }

            var mediaEl;
            if (mediaType === 'img') {
                mediaEl = document.createElement('img');
                mediaEl.loading = 'lazy';
                mediaEl.decoding = 'async';
                mediaEl.src = blobUrl || placeholder.dataset.src;
                mediaEl.alt = placeholder.dataset.alt || '';
                if (placeholder.dataset.className) mediaEl.className = placeholder.dataset.className;
                if (placeholder.dataset.cssText) mediaEl.style.cssText = placeholder.dataset.cssText;
                if (placeholder.dataset.width) mediaEl.style.width = placeholder.dataset.width;
                if (placeholder.dataset.height) mediaEl.style.height = placeholder.dataset.height;
            } else if (mediaType === 'video') {
                mediaEl = document.createElement('video');
                mediaEl.src = blobUrl || placeholder.dataset.src;
                if (placeholder.dataset.className) mediaEl.className = placeholder.dataset.className;
                if (placeholder.dataset.cssText) mediaEl.style.cssText = placeholder.dataset.cssText;
                if (placeholder.dataset.poster) mediaEl.poster = placeholder.dataset.poster;
                mediaEl.controls = true;
                mediaEl.preload = 'metadata';
            } else if (mediaType === 'iframe') {
                mediaEl = document.createElement('iframe');
                if (placeholder.dataset.className) mediaEl.className = placeholder.dataset.className;
                if (placeholder.dataset.cssText) mediaEl.style.cssText = placeholder.dataset.cssText;
                var finalUrl = blobUrl || placeholder.dataset.src;
                if (finalUrl && !finalUrl.includes('#')) finalUrl += '#toolbar=0&navpanes=0';
                mediaEl.src = finalUrl;
                mediaEl.style.width = '100%';
                mediaEl.style.height = '750px';
                mediaEl.style.border = 'none';
            }

            if (mediaEl) {
                mediaEl.onload = function() { placeholder.dataset.loaded = 'true'; };
                if (this.mediaObserver) this.mediaObserver.unobserve(placeholder);
                placeholder.parentNode.replaceChild(mediaEl, placeholder);
            }
        },
        loadAllMedia: function() {
            var placeholders = document.querySelectorAll('.media-lazy-placeholder');
            console.log('[Reader] Loading all media:', placeholders.length);
            var self = this;
            for (var i = 0; i < placeholders.length; i++) {
                var ph = placeholders[i];
                self.loadMediaElement(ph, parseInt(ph.dataset.articleIndex), parseInt(ph.dataset.mediaIndex), ph.dataset.mediaType);
            }
        },
`;
}
