const { generateGraphHtml } = require('./src/utils/graphRenderer.ts');
const tsNode = require('ts-node');
tsNode.register({ compilerOptions: { module: 'commonjs' } });

// 引入模块
const graphMod = require('./src/utils/graphRenderer.ts');
const data = {
    nodes: [
        { id: '1', name: 'Test', type: 'technology', weight: 10, description: 'desc' }
    ],
    links: []
};

const html = graphMod.generateGraphHtml(data);
console.log('--- OUTPUT ---');
console.log(html.substring(0, 500));
console.log('--- SRCDOC ---');
const match = html.match(/srcdoc="([^"]+)"/);
if (match) {
    console.log('Found srcdoc of length:', match[1].length);
    console.log(match[1].substring(0, 200));
} else {
    console.log('No srcdoc found!');
}