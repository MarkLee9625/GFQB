
// Wrapper to access global pdfjsLib
// This avoids importing the huge pdfjs-dist library during build,
// preventing esbuild/vite memory crashes.

// 动态加载状态
let isLoading = false;
let loadPromise: Promise<any> | null = null;

/**
 * 尝试动态加载 PDF.js 库 (主要用于开发环境)
 */
export const ensurePdfLibLoaded = async () => {
    if (typeof window === 'undefined') return null;
    if (window.pdfjsLib || window['pdfjs-dist/build/pdf']) return window.pdfjsLib || window['pdfjs-dist/build/pdf'];

    if (loadPromise) return loadPromise;

    console.log('[PDF Wrapper] 正在尝试动态加载 PDF.js...');
    loadPromise = (async () => {
        try {
            // 通过 new Function 隐藏导入语句，彻底躲避 Vite 的静态分析
            // 因为 Vite 会扫描代码中的 import() 调用，甚至是带 ignore 注释的情况
            const loadModule = new Function('path', 'return import(path)');
            const m = await loadModule('/pdf.min.mjs');
            window.pdfjsLib = m;
            console.log('[PDF Wrapper] PDF.js 动态加载完成');
            return m;
        } catch (err) {
            console.warn('[PDF Wrapper] 动态加载失败，可能在构建环境下由 post-build 注入:', err);
            return null;
        }
    })();

    return loadPromise;
};

// 使用 Proxy 确保即使库还没加载，代码也不会直接崩溃
// @ts-ignore
export const pdfjsLib: any = new Proxy({}, {
    get(target, prop) {
        // 每次访问时检查全局变量
        // @ts-ignore
        const lib = typeof window !== 'undefined' ? (window.pdfjsLib || window['pdfjs-dist/build/pdf']) : null;
        if (lib) return lib[prop];

        // 如果还没加载，触发异步加载 (但不阻塞此处返回)
        if (typeof window !== 'undefined') {
            ensurePdfLibLoaded();
        }

        return undefined;
    }
});
