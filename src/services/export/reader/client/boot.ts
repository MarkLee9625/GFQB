/**
 * 离线阅读器客户端脚本 - 启动自举片段（Worker 解压/直解/initReader/全局监听）
 *
 * 约束：返回的 ES5 代码字符串内严禁出现反引号与 ${}。
 * 由 clientScript 组装到 `window.app` 挂载之后，原样搬运，运行时语义不变。
 */

export function getClientBootCode(): string {
    return `
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
