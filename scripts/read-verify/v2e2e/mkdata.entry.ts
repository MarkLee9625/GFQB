/**
 * v2e2e 数据构造（esbuild 打包后跑在 node，仅测试用）。
 * 复用生产代码：sortArticlesByPriority + stripRedundantBlocks + buildV2Manifest + compressData，
 * 把工程备份文章注入新模板，产出待测阅读包（v1/v2）。
 * 用法: node mkdata.mjs <v1|v2> <project.html> <template.html> <out.html> [subsetN]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildV2Manifest, stripRedundantBlocks } from '../../../src/services/export/v2format';
import { compressData, uint8ArrayToBase64 } from '../../../src/services/export/compression';
import { sortArticlesByPriority } from '../../../src/utils/articleSort';
import type { Article } from '../../../src/types';

const esc = (s: string) => s.replace(/<\//g, '<\\/');

async function gzB64(text: string): Promise<{ b64: string; method: string }> {
  const c = await compressData(text, 'gzip');
  return { b64: uint8ArrayToBase64(c.data), method: c.method };
}

async function main() {
  const [, , format, projectPath, templatePath, outPath, subsetN] = process.argv;
  if (format !== 'v1' && format !== 'v2') throw new Error('format 须为 v1|v2');
  const raw = readFileSync(projectPath, 'utf-8');
  const a = raw.indexOf('DATA START');
  const b = raw.indexOf('DATA END');
  if (a < 0 || b <= a) throw new Error('工程备份标记缺失');
  let articles = JSON.parse(raw.slice(a + 'DATA START'.length, b)) as Article[];
  articles = sortArticlesByPriority(articles);
  if (subsetN) {
    const n = Number(subsetN);
    const cover = articles.filter((x) => x.category === '封面');
    const back = articles.filter((x) => x.category === '封底');
    const mid = articles.filter((x) => x.category !== '封面' && x.category !== '封底').slice(0, n);
    articles = [...cover, ...mid, ...back];
  }
  const { slim } = stripRedundantBlocks(articles);
  const config = JSON.stringify({
    company: { NAME: 'e2e' },
    version: '1.0.0',
    alternateDesign: false,
    logo: '',
    sidebarMeta: 'v2e2e',
  });
  const configB64 = (await gzB64(config)).b64;

  let script: string;
  if (format === 'v2') {
    const m = buildV2Manifest(slim);
    const meta = await gzB64(JSON.stringify(m.shells));
    const bodies: string[] = [];
    for (const bodyJson of m.bodyJsons) bodies.push((await gzB64(bodyJson)).b64);
    const arr = (xs: string[]) => `[${xs.map((x) => `"${esc(x)}"`).join(',')}]`;
    script = `<script>window.__SWS_FORMAT__="v2";window.__SWS_V2_METHOD__="${meta.method}";window.__SWS_V2_META_B64__="${esc(meta.b64)}";window.__SWS_V2_BODIES_B64__=${arr(bodies)};window.__SWS_V2_MEDIA__=${arr(m.media)};window.__SWS_DATA_CONFIG_B64__="${esc(configB64)}";window.__SWS_COMPRESSION_METHOD__="${meta.method}";</script>`;
    console.log(JSON.stringify({ format, articles: slim.length, bodies: bodies.length, media: m.media.length }));
  } else {
    const c = await gzB64(JSON.stringify(slim));
    script = `<script>window.__SWS_DATA_ARTICLES_B64__="${esc(c.b64)}";window.__SWS_DATA_CONFIG_B64__="${esc(configB64)}";window.__SWS_COMPRESSION_METHOD__="${c.method}";</script>`;
    console.log(JSON.stringify({ format, articles: slim.length }));
  }

  const tpl = readFileSync(templatePath, 'utf-8');
  const timer = `<script>window.__T0=Date.now();</script>`;
  const withTimer = tpl.includes('<head>') ? tpl.replace('<head>', `<head>${timer}`) : timer + tpl;
  const html = withTimer.includes('<!--SWS_READER_DATA-->')
    ? withTimer.replace('<!--SWS_READER_DATA-->', () => script)
    : withTimer.replace('</body>', () => `${script}</body>`);
  writeFileSync(outPath, html);
  console.log(JSON.stringify({ out: outPath, mb: (html.length / 1024 / 1024).toFixed(1) }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
