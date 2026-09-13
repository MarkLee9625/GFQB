/**
 * 离线阅读器客户端脚本 - 文章渲染片段（列表/全文/封面/封底/正文模板渲染）
 *
 * 约束：返回的 ES5 代码字符串内严禁出现反引号与 ${}。
 * 各片段为 `var app = {...}` 对象字面量的方法定义，依赖运行时 `this`，由 clientScript 组装。
 * 注意：下载失败的 `alert` 调用为 AGENTS.md 明确豁免（阅读器内联脚本），予以保留。
 */

export function getClientRenderMethodsCode(): string {
    return `
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
            var imageLayer = node.querySelector('.cover-image-layer');
            if (coverImgUrl) {
                var img = document.createElement('img');
                img.loading = 'eager';
                img.decoding = 'async';
                img.src = coverImgUrl;
                img.alt = "Cover";
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                var s = parseFloat(article.scale) || 1;
                var x = parseFloat(article.posX) || 0;
                var y = parseFloat(article.posY) || 0;
                if (s !== 1 || x !== 0 || y !== 0) {
                    img.style.transformOrigin = 'center';
                    img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                }
                if (imageLayer && imagePlaceholder) {
                    imageLayer.replaceChild(img, imagePlaceholder);
                } else if (imagePlaceholder) {
                    imagePlaceholder.parentNode.replaceChild(img, imagePlaceholder);
                }
            }
            var ambientBg = node.querySelector('.ambient-bg');
            if (!self.alternateDesign && ambientBg && coverImgUrl) ambientBg.style.backgroundImage = 'url(' + coverImgUrl + ')';
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
                var imageLayer = node.querySelector('.cover-image-layer');
                var placeholder = imageLayer ? imageLayer.querySelector('.magazine-image-placeholder') : null;
                if (backImgUrl && placeholder && imageLayer) {
                    var img = document.createElement('img');
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.src = backImgUrl;
                    img.alt = "Back Cover";
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                    var s = parseFloat(article.scale) || 1;
                    var x = parseFloat(article.posX) || 0;
                    var y = parseFloat(article.posY) || 0;
                    if (s !== 1 || x !== 0 || y !== 0) {
                        img.style.transformOrigin = 'center';
                        img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                    }
                    imageLayer.replaceChild(img, placeholder);
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
                var imageLayer = node.querySelector('.cover-image-layer');
                var placeholder = imageLayer ? imageLayer.querySelector('.cover-img-placeholder') : null;
                if (backImgUrl && placeholder && imageLayer) {
                    var img = document.createElement('img');
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.src = backImgUrl;
                    img.alt = "Back Cover";
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                    var s = parseFloat(article.scale) || 1;
                    var x = parseFloat(article.posX) || 0;
                    var y = parseFloat(article.posY) || 0;
                    if (s !== 1 || x !== 0 || y !== 0) {
                        img.style.transformOrigin = 'center';
                        img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                    }
                    imageLayer.replaceChild(img, placeholder);
                }
                var bgContainer = node.querySelector('[data-field="bgStyle"]');
                if (bgContainer && backImgUrl) {
                    bgContainer.style.backgroundImage = 'url(' + backImgUrl + ')';
                    bgContainer.style.backgroundSize = 'cover';
                    bgContainer.style.backgroundPosition = 'center';
                    bgContainer.style.opacity = '0.3';
                    bgContainer.style.filter = 'blur(60px) saturate(180%) brightness(1.05)';
                    bgContainer.style.transform = 'scale(1.2)';
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
`;
}
