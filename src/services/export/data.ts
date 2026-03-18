import { Article } from '../../../types';
import { encodeContent } from './utils/file';

/**
 * 导出项目数据 (用于备份或迁移)
 */
export function generateExportHtml(articles: Article[], config: any): string {
    const data = {
        articles,
        config,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>SWS Project Export</title>
</head>
<body>
    <div id="export-data" style="display:none;">${encodeContent(JSON.stringify(data))}</div>
    <script>
        console.log("Project data exported successfully.");
        // 可以添加一些简单的预览逻辑
    </script>
</body>
</html>`;
}


