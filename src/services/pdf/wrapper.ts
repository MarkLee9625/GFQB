import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfLibLoaded = false;

export async function ensurePdfLibLoaded(): Promise<void> {
    if (pdfLibLoaded) return;

    if (typeof window !== 'undefined' && !(window as any).pdfjsDist) {
        (window as any).pdfjsDist = pdfjsLib;
    }

    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        console.log(`[PDF服务] GlobalWorkerOptions 配置成功: ${workerUrl}`);
    }

    pdfLibLoaded = true;
}

export { pdfjsLib, workerUrl };
