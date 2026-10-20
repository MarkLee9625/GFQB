/**
 * 第3期端到端复现素材（被 print.issue3.test.ts 的 mock 动态 import）。
 * issue3-prep.py 已把 63 张内容光栅按 pdf 字节 sha1 归档到 .tmp/issue3-rasters/。
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERIFY_DIR = path.resolve(HERE, '../../../scripts/print-verify');
export const TMP_DIR = path.join(VERIFY_DIR, '.tmp');
export const RASTERS_DIR = path.join(TMP_DIR, 'issue3-rasters');

interface PdfMapEntry {
  id: number;
  title: string;
  order: number;
  pdfPages: number;
  pdfSha1: string;
  rasters: Array<{ file: string; mime: string; bytes: number; fromPdfPage: number }>;
}

let cache: { bySha1: Map<string, string[]> } | null = null;

function load(): { bySha1: Map<string, string[]> } {
  if (cache) return cache;
  const pdfmap = JSON.parse(
    fs.readFileSync(path.join(TMP_DIR, 'issue3-pdfmap.json'), 'utf-8')
  ) as { pdfArticles: PdfMapEntry[]; logo: string; sidebarMeta: string };
  const bySha1 = new Map<string, string[]>();
  for (const entry of pdfmap.pdfArticles) {
    const uris = entry.rasters.map((r) => {
      const buf = fs.readFileSync(path.join(RASTERS_DIR, r.file));
      return `data:${r.mime};base64,${buf.toString('base64')}`;
    });
    bySha1.set(entry.pdfSha1, uris);
  }
  cache = { bySha1 };
  return cache;
}

export function issue3Meta(): { logo: string; sidebarMeta: string } {
  const pdfmap = JSON.parse(
    fs.readFileSync(path.join(TMP_DIR, 'issue3-pdfmap.json'), 'utf-8')
  ) as { logo: string; sidebarMeta: string };
  return { logo: pdfmap.logo, sidebarMeta: pdfmap.sidebarMeta };
}

/** 按 pdf 字节命中光栅（与 prep 侧 sha1 同口径），未命中抛错（不静默空转） */
export async function issue3RastersForPdf(file: File): Promise<string[]> {
  const buf = Buffer.from(await file.arrayBuffer());
  const sha1 = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  const uris = load().bySha1.get(sha1);
  if (!uris) throw new Error(`[issue3] pdf 未命中光栅映射: sha1=${sha1} bytes=${buf.length}`);
  return uris;
}
