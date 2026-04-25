import { SHARED_STYLES, MAGAZINE_STYLES, PRINT_STYLES, MISC_STYLES, SEASONAL_STYLES, SVG_ICONS } from '../assets';

export function getClientScript() {
    return `
    function forEach(list, callback) {
        if (!list) return;
        for (var i = 0; i < list.length; i++) {
            callback(list[i], i);
        }
    }

    function escapeForJS(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function findParent(el, cls) {
        while (el && el !== document) {
            if (el.classList && el.classList.contains(cls)) return el;
            el = el.parentNode;
        }
        return null;
    }

    var app = {
        data: [],
        blobCache: null,
        currentIndex: 0,
        alternateDesign: false,
        mediaObserver: null,

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

        init: function() {
            try {
                document.body.classList.add('is-offline-reader');

                this.data = Array.isArray(window.__SWS_DATA_ARTICLES__) ? window.__SWS_DATA_ARTICLES__ : [];
                var newConfig = window.__SWS_DATA_CONFIG__ || {};
                var LOGO = newConfig.logo || "";
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
            var searchRegex = null;
            if (term) {
                var pattern = '[.*+?^\\$\\{\\}()|\\[\\]\\\\]';
                var safeTerm = term.replace(new RegExp(pattern, 'g'), '\\$&');
                searchRegex = new RegExp(safeTerm, 'i');
            }
            var self = this;
            this.data.forEach(function(item, index) {
                if (searchRegex) {
                    var matchTitle = item.title && searchRegex.test(item.title);
                    var matchContent = item.content && searchRegex.test(item.content);
                    if (!matchTitle && !matchContent) return;
                }
                var li = document.createElement('li');
                li.className = 'nav-item ' + (index === self.currentIndex ? 'active' : '');
                li.id = 'nav-item-' + index;
                li.onclick = function() { self.scrollToArticle(index); };
                var isSpecial = item.category === '封面' || item.category === '封底';
                li.innerHTML = '<div class="nav-item-title ' + (isSpecial ? 'special-title' : '') + '">' + escapeForJS(item.title) + '</div>';
                listEl.appendChild(li);
            });
        },

        renderAll: function() {
            var container = document.getElementById('render-target');
            if (!container) {
                console.error('[Reader] render-target container not found!');
                return;
            }
            console.log('[Reader] Rendering all articles, count:', this.data.length);
            container.innerHTML = '';
            var self = this;
            for (var i = 0; i < this.data.length; i++) {
                try {
                    var article = this.data[i];
                    if (!article) {
                        console.warn('[Reader] Article #' + i + ' is null, skipping');
                        continue;
                    }
                    var wrapper = document.createElement('div');
                    wrapper.className = 'article-wrapper';
                    wrapper.id = 'article-' + i;
                    
                    if (article.category === '封面') {
                        console.log('[Reader] Rendering cover #' + i);
                        self.renderCover(wrapper, article);
                    } else if (article.category === '封底') {
                        console.log('[Reader] Rendering back #' + i);
                        self.renderBack(wrapper, article);
                    } else {
                        console.log('[Reader] Rendering article #' + i + ':', article.title || 'Untitled');
                        self.renderNormal(wrapper, article);
                        
                        var mediaElements = wrapper.querySelectorAll('.article-body img, .article-body video, iframe[data-pdf-src]');
                        for (var j = 0; j < mediaElements.length; j++) {
                            var mediaEl = mediaElements[j];
                            var placeholder = document.createElement('div');
                            placeholder.className = 'media-lazy-placeholder';
                            placeholder.dataset.articleIndex = i;
                            placeholder.dataset.mediaIndex = j;
                            var mediaType = mediaEl.tagName.toLowerCase();
                            placeholder.dataset.mediaType = mediaType;
                            placeholder.dataset.className = mediaEl.className || '';
                            placeholder.dataset.cssText = mediaEl.style.cssText || '';
                            if (mediaType === 'img') {
                                placeholder.dataset.src = mediaEl.getAttribute('data-src') || mediaEl.src || '';
                                placeholder.dataset.alt = mediaEl.alt || '';
                                if (mediaEl.style.width) placeholder.style.width = mediaEl.style.width;
                                if (mediaEl.style.height) placeholder.style.height = mediaEl.style.height;
                            } else if (mediaType === 'video') {
                                placeholder.dataset.src = mediaEl.getAttribute('data-src') || mediaEl.src || '';
                                placeholder.dataset.poster = mediaEl.poster || '';
                            } else if (mediaType === 'iframe') {
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
                            placeholder.innerHTML = '[' + mediaType.toUpperCase() + ']';
                            mediaEl.parentNode.replaceChild(placeholder, mediaEl);
                        }
                    }
                    container.appendChild(wrapper);
                } catch (renderErr) {
                    console.error('[Reader] Article #' + i + ' render failed:', renderErr);
                }
            }
            console.log('[Reader] All articles rendered, total:', this.data.length);
        },

        renderCover: function(el, article) {
            var templateId = this.alternateDesign ? 'tpl-magazine-cover' : 'tpl-normal-cover';
            var tpl = document.getElementById(templateId);
            if (!tpl) {
                console.error('[Reader] Cover template not found: #' + templateId);
                el.innerHTML = '<div style="padding:40px;text-align:center;">Cover template missing</div>';
                return;
            }
            var node;
            if (tpl.content) {
                node = tpl.content.cloneNode(true);
            } else {
                var div = document.createElement('div');
                div.innerHTML = tpl.innerHTML;
                node = document.createDocumentFragment();
                while (div.firstChild) node.appendChild(div.firstChild);
            }
            var self = this;
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
                img.className = imagePlaceholder ? (imagePlaceholder.className.indexOf('magazine') !== -1 ? 'magazine-image' : 'cover-img') : 'cover-img';
                img.alt = "Cover";
                if (!self.alternateDesign) {
                    var s = parseFloat(article.scale) || 1;
                    var x = parseFloat(article.posX) || 0;
                    var y = parseFloat(article.posY) || 0;
                    img.style.transformOrigin = 'center';
                    img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                }
                if (imagePlaceholder) imagePlaceholder.parentNode.replaceChild(img, imagePlaceholder);
                var ambientBg = node.querySelector('.ambient-bg');
                if (!self.alternateDesign && ambientBg) ambientBg.style.backgroundImage = 'url(' + coverImgUrl + ')';
            }
            el.appendChild(node);
            var startBtn = el.querySelector('.magazine-button');
            if (startBtn) startBtn.onclick = function(e) { e.preventDefault(); self.next(); };
        },

        renderBack: function(el, article) {
            var templateId = this.alternateDesign ? 'tpl-magazine-back' : 'tpl-normal-back';
            var tpl = document.getElementById(templateId);
            if (!tpl) {
                console.error('[Reader] Back template not found: #' + templateId);
                el.innerHTML = '<div style="padding:40px;text-align:center;">Back template missing</div>';
                return;
            }
            var node;
            if (tpl.content) {
                node = tpl.content.cloneNode(true);
            } else {
                var div = document.createElement('div');
                div.innerHTML = tpl.innerHTML;
                node = document.createDocumentFragment();
                while (div.firstChild) node.appendChild(div.firstChild);
            }
            var backImgUrl = this.base64ToBlobUrl(article.backImage, 'img');
            var self = this;
            if (this.alternateDesign) {
                var fields = node.querySelectorAll('[data-field]');
                forEach(fields, function(elem) {
                    var field = elem.dataset.field;
                    if (field === 'logo') { if (window._SWS_LOGO) elem.src = window._SWS_LOGO; else elem.style.display = 'none'; }
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
                    var field = elem.dataset.field;
                    if (field === 'logo') {
                        var imgElem = elem.tagName === 'IMG' ? elem : elem.querySelector('img');
                        if (imgElem) { if (window._SWS_LOGO) imgElem.src = window._SWS_LOGO; else imgElem.style.display = 'none'; }
                    }
                    if (field === 'issueText') elem.textContent = article.issueText || '01';
                    if (field === 'dateText') elem.textContent = article.dateText || 'JAN 2025';
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
            if (!tpl) {
                console.error('[Reader] Article template not found: #tpl-article');
                el.innerHTML = '<div style="padding:40px;text-align:center;">Article template missing</div>';
                return;
            }
            var node;
            if (tpl.content) {
                node = tpl.content.cloneNode(true);
            } else {
                var div = document.createElement('div');
                div.innerHTML = tpl.innerHTML;
                node = document.createDocumentFragment();
                while (div.firstChild) node.appendChild(div.firstChild);
            }
            var self = this;
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
                        elem.innerHTML = tagsArr.map(function(t) { return '<span class="tag-item">' + escapeForJS(t) + '</span>'; }).join('');
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
                    var temp = document.createElement('template');
                    temp.innerHTML = article.content || '';
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
                    if (imgElem) { if (window._SWS_LOGO) imgElem.src = window._SWS_LOGO; else imgElem.style.display = 'none'; }
                }
                if (field === 'pdf-viewer' && article.pdfData) {
                    elem.style.display = 'block';
                    var iframe = elem.querySelector('[data-field="pdf-iframe"]');
                    if (iframe) iframe.setAttribute('data-pdf-src', 'pending-lazy-load');
                    var dlBtn = elem.querySelector('[data-field="pdf-download-btn"]');
                    if (dlBtn) {
                        dlBtn.onclick = function(e) {
                            e.preventDefault();
                            try {
                                var pdfUrl = self.base64ToBlobUrl(article.pdfData, 'pdf');
                                var link = document.createElement('a');
                                link.href = pdfUrl;
                                link.download = (article.title || 'document') + '.pdf';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            } catch(err) { alert('Download failed'); }
                        };
                    }
                }
            });
            el.appendChild(node);
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
                        '<div class="nav-card"><div class="nav-card-label">' + svgPrevArrow + ' Previous</div>' +
                            '<div class="nav-card-title">' + (prevArt ? escapeForJS(prevArt.title) : 'First article') + '</div></div></a>' +
                    '<a class="nav-link next ' + (!nextArt ? 'disabled' : '') + '" onclick="' + (nextArt ? 'app.next()' : '') + '">' +
                        '<div class="nav-card next"><div class="nav-card-label">Next ' + svgArrow + '</div>' +
                            '<div class="nav-card-title">' + (nextArt ? escapeForJS(nextArt.title) : 'Last article') + '</div></div></a></div>';
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
                btn.textContent = 'Exit Fullscreen';
                document.body.style.overflow = 'hidden';
            } else {
                var placeholder = container._placeholder;
                container.classList.remove('expanded');
                if (placeholder && placeholder.parentNode) {
                   placeholder.parentNode.insertBefore(container, placeholder);
                   placeholder.parentNode.removeChild(placeholder);
                }
                btn.textContent = 'Fullscreen';
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

    function decompressInWorker(method, updateProgress) {
        return new Promise(function(resolve, reject) {
            var workerCode = [
                'self.onmessage=async function(e){',
                'try{',
                'var aB=e.data.aB,cB=e.data.cB,m=e.data.m;',
                'function b2u(b){var bin=atob(b);var u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}',
                'async function dec(b,fmt){var bytes=b2u(b);var ds=new DecompressionStream(fmt);',
                'var rs=new ReadableStream({start:function(c){c.enqueue(bytes);c.close();}});',
                'var pipe=rs.pipeThrough(ds);var rd=pipe.getReader();var ch=[];var sz=0;',
                'while(true){var r=await rd.read();if(r.done)break;ch.push(r.value);sz+=r.value.length;}',
                'var res=new Uint8Array(sz);var o=0;for(var i=0;i<ch.length;i++){res.set(ch[i],o);o+=ch[i].length;}',
                'return new TextDecoder().decode(res);}',
                'self.postMessage({t:"p",v:10});',
                'var aj=await dec(aB,m);self.postMessage({t:"p",v:60});',
                'var cj=await dec(cB,m);self.postMessage({t:"p",v:90});',
                'self.postMessage({t:"d",a:JSON.parse(aj),c:JSON.parse(cj)});',
                '}catch(err){self.postMessage({t:"e",v:err.message||String(err)});}',
                '};'
            ].join('\\n');
            var blob = new Blob([workerCode], { type: 'application/javascript' });
            var workerUrl = URL.createObjectURL(blob);
            var worker = new Worker(workerUrl);
            worker.onmessage = function(e) {
                var msg = e.data;
                if (msg.t === 'p') { updateProgress(msg.v, '正在解压 ' + msg.v + '%'); }
                else if (msg.t === 'd') { worker.terminate(); URL.revokeObjectURL(workerUrl); resolve({ articles: msg.a, config: msg.c }); }
                else if (msg.t === 'e') { worker.terminate(); URL.revokeObjectURL(workerUrl); reject(new Error(msg.v)); }
            };
            worker.onerror = function(err) { worker.terminate(); URL.revokeObjectURL(workerUrl); reject(err); };
            worker.postMessage({ aB: window.__SWS_DATA_ARTICLES_B64__, cB: window.__SWS_DATA_CONFIG_B64__, m: method });
        });
    }

    async function decompressDirect(b64, method, cb) {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        cb(30);
        var ds = new DecompressionStream(method);
        var rs = new ReadableStream({ start: function(c) { c.enqueue(bytes); c.close(); } });
        var pipe = rs.pipeThrough(ds);
        var reader = pipe.getReader();
        var chunks = []; var size = 0;
        var totalEst = bytes.length * 3;
        while (true) {
            var r = await reader.read();
            if (r.done) break;
            chunks.push(r.value);
            size += r.value.length;
            cb(Math.min(90, 30 + Math.round(size / totalEst * 60)));
        }
        var result = new Uint8Array(size); var off = 0;
        for (var i = 0; i < chunks.length; i++) { result.set(chunks[i], off); off += chunks[i].length; }
        cb(100);
        return new TextDecoder().decode(result);
    }

    (async function initReader() {
        var progressEl = document.querySelector('.progress-text');
        function updateProgress(percent, message) {
            if (progressEl) progressEl.textContent = message || 'Loading ' + percent + '%...';
        }
        try {
            updateProgress(0, '正在加载数据...');
            var method = window.__SWS_COMPRESSION_METHOD__ || 'none';
            if (method === 'none') {
                window.__SWS_DATA_ARTICLES__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_ARTICLES_B64__))));
                window.__SWS_DATA_CONFIG__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_CONFIG_B64__))));
            } else if (typeof Worker !== 'undefined' && typeof DecompressionStream !== 'undefined') {
                var result = await decompressInWorker(method, updateProgress);
                window.__SWS_DATA_ARTICLES__ = result.articles;
                window.__SWS_DATA_CONFIG__ = result.config;
            } else {
                var ad = await decompressDirect(window.__SWS_DATA_ARTICLES_B64__, method, function(p) { updateProgress(p, '数据 ' + p + '%'); });
                window.__SWS_DATA_ARTICLES__ = JSON.parse(ad);
                var cd = await decompressDirect(window.__SWS_DATA_CONFIG_B64__, method, function(p) { updateProgress(p, '配置 ' + p + '%'); });
                window.__SWS_DATA_CONFIG__ = JSON.parse(cd);
            }
            updateProgress(100, '就绪');
        } catch(e) {
            console.error('[Reader] 解压失败，尝试降级:', e);
            try {
                if (typeof DecompressionStream !== 'undefined') {
                    var ad2 = await decompressDirect(window.__SWS_DATA_ARTICLES_B64__, window.__SWS_COMPRESSION_METHOD__, function(){});
                    window.__SWS_DATA_ARTICLES__ = JSON.parse(ad2);
                    var cd2 = await decompressDirect(window.__SWS_DATA_CONFIG_B64__, window.__SWS_COMPRESSION_METHOD__, function(){});
                    window.__SWS_DATA_CONFIG__ = JSON.parse(cd2);
                } else {
                    window.__SWS_DATA_ARTICLES__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_ARTICLES_B64__))));
                    window.__SWS_DATA_CONFIG__ = JSON.parse(decodeURIComponent(escape(atob(window.__SWS_DATA_CONFIG_B64__))));
                }
            } catch(fe) {
                console.error('[Reader] 降级也失败:', fe);
                window.__SWS_DATA_ARTICLES__ = []; window.__SWS_DATA_CONFIG__ = {};
            }
        }
        console.log('[Reader] 数据就绪，文章数:', window.__SWS_DATA_ARTICLES__.length);
        window.app.init();
    })();

    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement) {
            document.body.classList.remove('immersive-mode');
            var sb = document.getElementById('sidebar');
            if (sb) sb.classList.remove('hidden');
        }
    });

    window.addEventListener('message', function(event) {
        if (!event.data) return;
        if (event.data.type === 'GRAPH_SEARCH_KEYWORD') {
            var keyword = event.data.keyword;
            var found = window.find(keyword, false, false, true, false, false, false);
            if (!found) window.find(keyword, false, true, true, false, false, false);
        }
        if (event.data.type === 'GRAPH_REQUEST_DATA' && event.data.uid) {
            var uid = event.data.uid;
            var el = document.getElementById('data-' + uid);
            if (el) {
                var f = document.getElementById('iframe-' + uid);
                if (f && f.contentWindow) {
                    f.contentWindow.postMessage({ type: 'GRAPH_DATA_RESPONSE', uid: uid, dataB64: el.textContent }, '*');
                }
            }
        }
    });
`;
}
