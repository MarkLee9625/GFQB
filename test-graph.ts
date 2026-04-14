import { generateGraphHtml } from './src/utils/graphRenderer.js';
import * as fs from 'fs';

const data = {
    nodes: [
        { id: '1', name: 'Test "with quotes" and <brackets>', type: 'technology', weight: 10, description: 'desc\nnew line' }
    ],
    links: []
};

const html = generateGraphHtml(data);
// 为了模拟 reader.ts 的行为
const readerSim = { content: html };
let newContent = readerSim.content;

// 模拟 templates.ts
const appData = [ { content: newContent } ];
const rawArticlesJson = JSON.stringify(appData);
const articlesJson = rawArticlesJson.split('</script>').join('<\\/script>');
console.log('--- JSON Snippet ---');
console.log(articlesJson.substring(0, 300));
console.log('--- SRCDOC Extract ---');
const match = html.match(/srcdoc="([^"]+)"/);
if (match) {
    console.log('srcdoc extracted correctly, length:', match[1].length);
    // 检查 srcdoc 里的 entity decoding
    const decoded = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    console.log('Decoded start:', decoded.substring(0, 100));
    console.log('Contains JSON parse error?', decoded.includes('JSON.parse'));
}