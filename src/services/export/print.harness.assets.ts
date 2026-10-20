/**
 * 台架素材加载（被 print.harness.test.ts 的 mock 动态 import，
 * 避开 vi.mock 工厂不可引用顶层变量的限制）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERIFY_DIR = path.resolve(HERE, '../../../scripts/print-verify');
export const ASSETS_DIR = path.join(VERIFY_DIR, 'assets');
export const TMP_DIR = path.join(VERIFY_DIR, '.tmp');

const RATIO_FILES: Record<string, string> = {
  '1224x1684': 'pdf-raster-1224x1684.png',
  '1208x1650a': 'pdf-raster-1208x1650-a.png',
  '1190x1616': 'pdf-raster-1190x1616.png',
  '1208x1650b': 'pdf-raster-1208x1650-b.png',
  '1190x1684': 'pdf-raster-1190x1684.png',
};

export function assetDataUri(key: string): string {
  const file = RATIO_FILES[key];
  if (!file) throw new Error(`未知 RATIO 标记: ${key}`);
  const buf = fs.readFileSync(path.join(ASSETS_DIR, file));
  return `data:image/png;base64,${buf.toString('base64')}`;
}
