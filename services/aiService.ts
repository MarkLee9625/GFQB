/**
 * AI 服务 - 通过 BFF 代理调用 DeepSeek API 进行多种智能处理
 * 注意：API Key 已从客户端移除，通过后端代理进行安全转发
 */

// 使用 DeepSeek Reasoning 模型
const MODEL_NAME = 'deepseek-reasoner';
// 前端通过本地 BFF 代理访问 DeepSeek API，解决跨域和 API Key 安全问题
const API_URL = `/api/deepseek/generate`;

// 导入 PDF 服务
import { extractAbstractFromPdf } from '../src/services/pdf/index';

// ==================== 通用工具函数 ====================

/**
 * 深度清洗 DeepSeek Reasoning 模型返回的 JSON 字符串
 * 处理 <think>...</think> 标签并提取有效的 JSON 部分
 */
function extractJsonFromReasoning(text: string): string {
    // 1. 移除 <think>...</think> 标签及其内容
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    // 2. 提前移除 Markdown 代码块标记，防止干扰边界截取
    text = text.replace(/```json/gi, '').replace(/```/g, '');
    
    // 3. 查找第一个 { 和最后一个 }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        throw new Error('无法从 AI 响应中提取有效的 JSON 数据');
    }
    
    // 4. 提取 JSON 字符串
    let jsonStr = text.substring(firstBrace, lastBrace + 1);
    
    // 5. 【核心修复】使用正则强行抹除所有的尾随逗号 (Trailing Commas)
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    
    // 5.5 【靶向修复】抹除大模型偶尔口吃产生的嵌套键名幻觉 (将 "id": "name": "nodeX" 强行纠正为 "id": "nodeX")
    jsonStr = jsonStr.replace(/"id"\s*:\s*"name"\s*:/g, '"id":');

    // 5.6 【靶向修复】抹除大模型漏掉 "id": 键名的幻觉 (将 { "node20", 强行纠正为 { "id": "node20",)
    jsonStr = jsonStr.replace(/({\s*)"(node\d+)"(\s*,)/g, '$1"id": "$2"$3');
    
    // 6. 【核心修复】保留换行符 \n 和回车符 \r，只清理绝对会引发崩溃的低位控制字符
    jsonStr = jsonStr.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]+/g, "");

    return jsonStr.trim();
}

/**
 * 清理纯文本响应中的推理标签
 */
function cleanPlainTextResponse(text: string): string {
    // 移除 <think>...</think> 标签及其内容
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * 清理 HTML 响应中的推理标签
 */
function cleanHtmlResponse(text: string): string {
    // 移除 <think>...</think> 标签及其内容
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ==================== 接口定义 ====================

/**
 * AI 文章元数据结果接口
 */
export interface AIResult {
    title: string;
    abstract: string;
    keywords: string[]; // 新增：提取的关键词
}

/**
 * 知识图谱节点接口
 */
export interface KnowledgeNode {
    id: string;
    name: string;
    type: 'technology' | 'process' | 'material' | 'equipment' | 'concept';
    weight: number; // 节点重要性权重 (1-10)
    description?: string;
}

/**
 * 知识图谱链接接口
 */
export interface KnowledgeLink {
    source: string; // 源节点 ID
    target: string; // 目标节点 ID
    relationship: string; // 关系描述
    strength: number; // 关系强度 (1-5)
}

/**
 * 知识图谱数据接口
 */
export interface KnowledgeGraphData {
    nodes: KnowledgeNode[];
    links: KnowledgeLink[];
}

/**
 * AI 批量评审结果接口
 */
export interface AiEvaluationResult {
  id: string;
  aiSummary: string; // AI 提炼的真实技术摘要
  decision: 'recommend' | 'reject';
  reason: string;
  tags: string[]; // AI 提取的关键词
}

// ==================== 核心 AI 方法 ====================

/**
 * 调用 DeepSeek API 生成文章总结与标题建议
 * @param content 文章正文内容
 * @returns Promise<AIResult> 
 */
export async function generateArticleMeta(content: string): Promise<AIResult> {
    const plainText = content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim().slice(0, 100000);

    const systemPrompt = `你是一名资深的船舶工程与智能制造领域的**技术主编**。请严格遵循以下规则处理用户提供的文章：
### 1. 【标题生成要求】
* 风格：拒绝生硬、拒绝学术化。要干练、有力、具有工程实战感。
* 结构：核心技术名词 + 动词/应用场景/成效。
* 字数：12 - 25 字。
* 优秀示例：大型邮轮薄板激光复合焊变形控制工艺
### 2. 【摘要生成要求】
* 核心逻辑：Why (痛点/背景) -> How (技术手段) -> Benefits (具体收益/数据)。
* 字数：控制在 100 字左右。言简意赅，直击核心。
### 3. 【标签/关键词生成要求】
* 数量：3 - 5 个。
* 必须包含：文章涉及的具体工艺环节或工种（如：涂装、焊接、总装等）。
* 绝对禁止：禁止生成"提质增效"、"智能化"等无实际技术细节的虚词。
### 输出格式：
你必须在思考过程结束后，**仅**输出以下合法的 JSON 结构，不要附带任何解释性前缀或后缀文字：
\`\`\`json
{"title": "生成的专业标题", "abstract": "生成的摘要内容", "keywords": ["标签1", "标签2"]}
\`\`\``;

    const userPrompt = `请阅读并分析以下文章内容：\n\n${plainText}`;

    try {
        console.log('[aiService] 开始生成文章元数据，内容长度:', plainText.length);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // 安全修复：添加自定义头部，向 BFF 代理服务器证明这是来自合法前端页面的请求
                // 防止外部直接调用代理接口盗刷额度
                'x-sws-proxy-secret': 'my-super-secret-key'
            },
        body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[aiService] 文章元数据生成请求失败:', { status: response.status, errorData });
            throw new Error(`AI 服务请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
            let text = data.choices[0].message.content;
            // 使用深度清洗函数处理可能的推理标签
            const cleanedText = extractJsonFromReasoning(text);
            const result = JSON.parse(cleanedText) as AIResult;
            console.log('[aiService] 文章元数据生成成功，标题:', result.title);
            return result;
        } else {
            console.error('[aiService] AI 服务返回数据格式异常:', data);
            throw new Error('AI 服务返回数据格式异常');
        }
    } catch (error) {
        console.error('[aiService] 文章元数据生成失败:', error);
        throw error;
    }
}

/**
 * 生成卷首语（HTML 格式）
 * @param articlesSummary 文章摘要汇总（多篇文章的标题和摘要拼接）
 * @returns Promise<string> HTML 格式的卷首语内容
 */
export async function generateForeword(articlesSummary: string): Promise<string> {
    const systemPrompt = `你是一名资深的工程期刊主编，拥有 20 年海工装备行业经验。请根据提供的文章摘要列表，撰写本期期刊的卷首语（宏观导读）。

### 【撰写要求】
1. **定位与视角**：站在行业宏观高度，洞察本期文章的技术脉络与产业价值。
2. **结构层次**：
   - 开篇：点明本期核心主题与技术趋势
   - 中段：逐一点评各篇文章的亮点与创新（不要简单罗列，要有机串联）
   - 结尾：总结本期价值，展望行业未来发展
3. **语言风格**：专业但不晦涩，权威但不高冷。采用技术主编的口吻，既要有学术深度，又要有行业温度。
4. **字数控制**：约 500 字。
5. **输出格式**：必须输出完整的 HTML 片段，使用标准的 HTML 标签（如 <p>, <h3>, <strong> 等），确保可直接嵌入网页显示。

### 【输出格式示例】
<p>本期《海洋工程智能建造》聚焦于船舶制造领域的关键技术创新...</p>
<h3>一、焊接工艺的智能化突破</h3>
<p>在大型邮轮薄板激光复合焊方面...</p>
<p>...</p>`;

    const userPrompt = `请为以下文章摘要列表撰写卷首语：\n\n${articlesSummary}`;

    try {
        console.log('[aiService] 开始生成卷首语，摘要长度:', articlesSummary.length);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-sws-proxy-secret': 'my-super-secret-key'
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[aiService] 卷首语生成请求失败:', { status: response.status, errorData });
            throw new Error(`AI 服务请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
            let text = data.choices[0].message.content;
            // 清理 HTML 响应中的推理标签
            const cleanedHtml = cleanHtmlResponse(text);
            console.log('[aiService] 卷首语生成成功，长度:', cleanedHtml.length);
            return cleanedHtml;
        } else {
            console.error('[aiService] AI 服务返回数据格式异常:', data);
            throw new Error('AI 服务返回数据格式异常');
        }
    } catch (error) {
        console.error('[aiService] 卷首语生成失败:', error);
        throw error;
    }
}

/**
 * 智能字数伸缩
 * @param text 需要处理的文本内容
 * @param mode 伸缩模式：'expand'（扩写）或 'shrink'（精简）
 * @returns Promise<string> 处理后的纯文本内容
 */
export async function scaleText(text: string, mode: 'expand' | 'shrink'): Promise<string> {
    const systemPrompt = mode === 'expand' 
        ? `你是一名资深的船舶工程编辑，擅长扩写技术文档。请对用户提供的文本进行专业扩写。

### 【扩写要求】
1. **扩写比例**：增加约 30% 的字数。
2. **内容方向**：
   - 补充专业技术细节和背景知识
   - 添加相关数据支撑和工艺参数
   - 解释关键技术的实施要点
   - 适当增加行业应用场景说明
3. **保持原意**：必须严格保持原文的核心观点和技术路线不变。
4. **语言风格**：保持专业、严谨的技术文档风格，避免口语化。
5. **输出格式**：返回纯文本，不要包含任何格式标记或注释。`
        : `你是一名资深的船舶工程编辑，擅长精简技术文档。请对用户提供的文本进行专业精简。

### 【精简要求】
1. **精简比例**：减少约 30% 的字数。
2. **保留内容**：
   - 核心技术指标和数据必须保留
   - 关键工艺步骤和原理必须保留  
   - 重要结论和发现必须保留
3. **删除内容**：
   - 冗余的背景介绍
   - 重复的表述
   - 非必要的修饰词
   - 次要的技术细节
4. **语言风格**：保持专业、简洁的技术文档风格。
5. **输出格式**：返回纯文本，不要包含任何格式标记或注释。`;

    const userPrompt = `请对以下文本进行 ${mode === 'expand' ? '扩写' : '精简'}：\n\n${text}`;

    try {
        console.log(`[aiService] 开始${mode === 'expand' ? '扩写' : '精简'}文本，原文字数:`, text.length);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-sws-proxy-secret': 'my-super-secret-key'
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`[aiService] 文本${mode === 'expand' ? '扩写' : '精简'}请求失败:`, { status: response.status, errorData });
            throw new Error(`AI 服务请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
            let text = data.choices[0].message.content;
            // 清理纯文本响应中的推理标签
            const cleanedText = cleanPlainTextResponse(text);
            console.log(`[aiService] 文本${mode === 'expand' ? '扩写' : '精简'}成功，新字数:`, cleanedText.length);
            return cleanedText;
        } else {
            console.error('[aiService] AI 服务返回数据格式异常:', data);
            throw new Error('AI 服务返回数据格式异常');
        }
    } catch (error) {
        console.error(`[aiService] 文本${mode === 'expand' ? '扩写' : '精简'}失败:`, error);
        throw error;
    }
}

/**
 * 提取全局知识图谱 (64K 满血专业版)
 * @param articlesText 多篇文章的文本内容（建议拼接后传入）
 * @returns Promise<KnowledgeGraphData> 知识图谱数据
 */
export async function extractGlobalKnowledgeGraph(articlesText: string): Promise<KnowledgeGraphData> {
    const systemPrompt = `你是一名顶级船舶工程领域的知识图谱专家，擅长从复杂的工业长文中，构建极具工程专业度、结构严谨的船舶工法图谱。

【最高指令：全局视野、流向清晰、构建高密复杂网】
系统为你开放了 64000 Tokens 的输出限制。你的核心任务不仅是提取硬核节点，更重要的是覆盖造船的全生命周期，并挖掘错综复杂的网状技术依赖关系！

### 【提取规范】
1. **节点识别 (全生命周期覆盖，拒绝局部扎堆)**：
   - 提取原文中最核心的技术概念、具体的工艺工法、实际的材料与硬核装备。
   - 【最高警告】坚决剔除“数字化转型”、“精益建造”、“技能危机”等宏观管理学废话！必须是看得见摸得着的工程实体！
   - 实体总数请控制在 25 到 40 个之间。宁可少提几个水词，也要把算力留给连线的挖掘。
   - **【广度强制令】请在生成节点时进行全局视角的均衡采样。只要原文涉及，你的节点必须尽可能覆盖造船的多个阶段（如：设计研发 -> 材料加工 -> 分段装配/焊接 -> 管系舾装 -> 涂装防腐 -> 测试交付）。**
   - id: 英文唯一标识
   - name: 中文名称
   - type: 必须在 ['technology', 'process', 'material', 'equipment', 'concept'] 中选择。
   - weight: 节点权重(1-10)。
   - description: 核心技术节点需提供 15-30 字硬核解释；次要或外围节点需缩减至 5-10 字极简概括。

2. **关系识别 (极限深挖，强制逻辑流向)**：
   - **【数量强制】**：关系连线（links）的总数必须是节点总数的 1.5 倍到 2 倍以上！绝对不允许出现大量孤立节点。
   - **【视觉流向(DAG)强制令】**：为了适配系统前端“左->中->右”的流水线可视化轨道，连线的 source 和 target 必须符合底层的工业传导因果链条！
     * \`source\`（起点）优先选择：上游动作、原材料(material)、驱动理念(concept)。
     * \`target\`（终点）优先选择：下游产物、被加工对象、应用设备(equipment)或具体技术(technology)。
     * **连线方向必须严格遵循：【concept / material】指向【process】，【process】指向【technology / equipment】的底层工业逻辑。绝对禁止逆向连线（如要求设备反向指向材料）！**
   - relationship: 关系动词。推荐使用“应用于”、“驱动”、“优化”、“依赖于”等标准短动词。只要有工程关系就大胆连。
   - strength: 关系强度 (1-5)。

3. **【极度危险警告：严格 JSON 规范，否则系统崩溃】**：
   - 绝不允许出现尾随逗号！
   - 仅输出纯 JSON，不要包裹 Markdown 标记。
   - 属性名和属性值中，如需引用文字，仅可使用中文引号（“”）。`;

    const userPrompt = `请从以下文章内容中，不遗漏任何细节地提取完整的知识图谱：\n\n${articlesText}`;

    try {
        console.log('[aiService] 开始提取满血版知识图谱，文本长度:', articlesText.length);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-sws-proxy-secret': 'my-super-secret-key'
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 64000 // 强制解锁 64K 输出上限
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[aiService] 知识图谱提取请求失败:', { status: response.status, errorData });
            throw new Error(`AI 服务请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
            let text = data.choices[0].message.content;
            const cleanedText = extractJsonFromReasoning(text);
            
            let graphData: KnowledgeGraphData;
            
            // 【核心：JSON 智能暴力自愈引擎】
            try {
                graphData = JSON.parse(cleanedText) as KnowledgeGraphData;
            } catch (parseError) {
                console.warn('[aiService] 检测到 JSON 截断或语法损坏，启动暴力自愈引擎...', parseError);
                let healedText = cleanedText.trim();
                
                // 1. 抹除尾随逗号
                healedText = healedText.replace(/,$/, '');
                
                // 2. 统计括号与引号数量，强制闭合
                const leftBraces = (healedText.match(/\{/g) || []).length;
                const rightBraces = (healedText.match(/\}/g) || []).length;
                const leftBrackets = (healedText.match(/\[/g) || []).length;
                const rightBrackets = (healedText.match(/\]/g) || []).length;
                const quotes = (healedText.match(/"/g) || []).length;
                
                if (quotes % 2 !== 0) healedText += '"';
                
                // 假设大模型是在写 links 数组时断掉的，强行补齐层级
                if (leftBraces > rightBraces) healedText += '}';
                if (leftBrackets > rightBrackets) healedText += ']';
                if (leftBraces > rightBraces + 1) healedText += '}'; 
                
                try {
                    console.log('[aiService] 尝试解析自愈后的 JSON...');
                    graphData = JSON.parse(healedText) as KnowledgeGraphData;
                    console.log('[aiService] JSON 自愈成功！成功抢救回大模型生成的巨量节点数据。');
                } catch (secondError) {
                    console.error('[aiService] 自愈失败，彻底放弃。原始文本：\n', cleanedText);
                    throw new Error('大模型输出数据严重截断且系统抢救失败，请稍后重试。');
                }
            }
            
            // 【架构级修复：柔性结构校验与兜底】
            // 1. 如果大模型截断太严重，连 links 都没开始写，自愈引擎闭合后 links 为 undefined，我们直接补齐为空数组！
            if (!graphData.nodes) graphData.nodes = [];
            if (!graphData.links) graphData.links = [];

            // 2. 靶向修复大模型幻觉：有时候它会在外面多套一层，比如 {"graph": {"nodes": [], "links": []}}
            if (!Array.isArray(graphData.nodes)) {
                const possibleRoot = Object.values(graphData).find(val => val && typeof val === 'object' && Array.isArray((val as any).nodes));
                if (possibleRoot) {
                    console.log('[aiService] 识别到大模型外层嵌套幻觉，已自动剥离外壳。');
                    graphData = possibleRoot as KnowledgeGraphData;
                    if (!graphData.links) graphData.links = []; // 再次兜底
                }
            }

            // 3. 最终死线校验
            if (!Array.isArray(graphData.nodes) || !Array.isArray(graphData.links)) {
                console.error('[aiService] 无法抢救的畸形数据结构:', graphData);
                throw new Error('知识图谱数据格式异常：无法识别 nodes 或 links 结构');
            }
            
            console.log('[aiService] 知识图谱提取成功，共生成节点:', graphData.nodes.length, '个，关系:', graphData.links.length, '条');
            return graphData;
        } else {
            console.error('[aiService] AI 服务返回数据格式异常:', data);
            throw new Error('AI 服务返回数据格式异常');
        }
    } catch (error) {
        console.error('[aiService] 知识图谱提取失败:', error);
        throw error;
    }
}

// ==================== 兼容旧版本方法 ====================

/**
 * 兼容旧版本：调用 Gemini API 生成文章总结
 * @deprecated 请优先使用 generateArticleMeta
 */
export async function generateArticleSummary(content: string): Promise<string> {
    const res = await generateArticleMeta(content);
    return res.abstract;
}

/**
 * 仅生成标题
 */
export async function generateTitleOnly(content: string): Promise<string> {
    // 截取前 50000 字以释放 DeepSeek 128K 上下文算力
    const plainText = content.replace(/<[^>]+>/g, '\n').slice(0, 50000);

    const systemPrompt = `你是一个专业的船舶工程编辑助手。请为用户提供的文章拟定一个专业的、简练且具有吸引力的标题。
要求：
1. 字数控制在 20 字以内。
2. 直接返回纯文本标题，不要包含任何标点符号（如书名号、引号）。
3. 思考完成后，仅输出标题本身，没有任何多余的问候语。`;

    const userPrompt = `文章内容如下：\n\n${plainText}`;

    try {
        console.log('[aiService] 开始生成标题，内容长度:', plainText.length);
        
        // 通过 BFF 代理调用 DeepSeek API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-sws-proxy-secret': 'my-super-secret-key'
            },
            body: JSON.stringify({ 
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[aiService] 标题生成请求失败:', { status: response.status, errorData });
            throw new Error('AI 服务请求失败');
        }
        
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || '';
        // 清理纯文本响应中的推理标签
        const cleanedText = cleanPlainTextResponse(text);
        const result = cleanedText.trim().replace(/^["']|["']$/g, ''); // 去除首尾引号
        
        console.log('[aiService] 标题生成成功:', result);
        return result;
    } catch (error) {
        console.error('[aiService] 标题生成失败:', error);
        throw error;
    }
}

/**
 * 批量评审文章（赛博总编引擎）
 * @param articlesToEvaluate 待评审的文章数组，包含 id, title, content
 * @returns Promise<AiEvaluationResult[]> AI 评审结果数组
 */
export async function batchEvaluateArticles(
  articlesToEvaluate: { id: string; title: string; content: string }[]
): Promise<AiEvaluationResult[]> {
  if (!articlesToEvaluate.length) return [];

  // 构造给 AI 的数据源，截取每篇文章前 3000 个字（去除长篇大论的废话，保留核心工艺描述，防超限）
  const inputData = JSON.stringify(articlesToEvaluate.map(a => ({
    id: a.id,
    title: a.title,
    content: a.content.replace(/[#*\[\]!>]/g, '').replace(/\s+/g, ' ').substring(0, 3000)
  })));

  const systemPrompt = `你是一位拥有20年经验的顶级船舶制造总工和《工法情报》期刊总编。
我将给你一批微信公众号文章的纯文本内容。请你认真阅读每篇文章的核心内容。

【收录标准】必须严格符合以下至少一项：
1. 涂装、舾装、吊装工艺与技术
2. 船舶建造核心工法
3. 国内外船厂的先进工艺实践或前沿工艺
4. 实际造船中采用的先进装备或工艺
5. 智能船舶与绿色船舶技术
6. 智能制造系统与造船机器人

【坚决淘汰】以下水文或非技术文章：
领导视察、会议纪要、党建活动、人事任命、公司获奖通报、行业宏观政策泛泛而谈等。

【输出要求】
请严格输出一个 JSON 数组。数组中的每个对象必须包含：
- "id": 对应输入文章的 id
- "aiSummary": 你提炼的该文章核心技术摘要（50字左右，必须客观精炼）
- "tags": 提取 2-3 个核心技术关键词标签（如 ["吊装工艺", "爬壁机器人"]）
- "decision": 结合摘要和标准，给出 "recommend" 或 "reject"
- "reason": 15字以内，说明为什么推荐或淘汰

千万不要输出 Markdown 代码块，直接返回纯正的 JSON 数组。`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-sws-proxy-secret': 'my-super-secret-key' 
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请评审以下文章：\n${inputData}` }
        ],
        temperature: 0.1, // 降低随机性，保证 JSON 稳定
      }),
    });

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('AI 服务返回内容为空');
    }
    
      // 【终极 JSON 洗衣机：工业级大模型防爆破解析】
    try {
      // 1. 暴力清除所有 Markdown 代码块标记
      content = content.replace(/\`\`\`(?:json)?/gi, '').replace(/\`\`\`/g, '').trim();
      
      // 2. 抹除可能会导致崩溃的低位控制字符
      content = content.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]+/g, "");
      
      // 3. 靶向修复 "JSONL 综合征" (输出多个对象但不加中括号)
      if (content.startsWith('{') && content.endsWith('}')) {
        // 将连续的 } { 替换为 },{ 
        content = content.replace(/}\s*{/g, '},{');
        content = `[${content}]`; // 强行套上数组外衣
      }

      // 4. 找到最外层的 [ 和 ]，直接截取（防止前面或后面有废话文本）
      const firstBracket = content.indexOf('[');
      const lastBracket = content.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        content = content.substring(firstBracket, lastBracket + 1);
      }

      // 5. 抹除尾随逗号 (Trailing comma)
      content = content.replace(/,\s*([}\]])/g, '$1');

      const results: AiEvaluationResult[] = JSON.parse(content);
      console.log('[aiService] AI 批量评审成功，结果数:', results.length);
      return results;
    } catch (parseError) {
      console.error("[aiService] JSON 洗衣机清洗失败！原始大模型输出为:\n", content);
      console.error("解析错误详情:", parseError);
      // 优雅降级：不要抛出致命错误阻断整个流水线，而是返回空数组跳过这 5 篇
      return []; 
    }
  } catch (error) {
    console.error('[aiService] AI 批量评审失败:', error);
    throw new Error('AI 评审解析失败，请重试');
  }
}

/**
 * 学术文献深度编译引擎：将英文学术论文翻译并重写为中文工法报道
 * @param article 包含标题和内容的学术文献
 * @returns Promise<string> Markdown 格式的中文工法报道
 */
export async function translateAndFormatAcademic(article: { title: string, content: string }): Promise<string> {
  console.log("[aiService] 启动学术文献深度编译...");

  const systemPrompt = `你是一位拥有20年经验的顶级船舶制造总工和《工法情报》期刊总编。
请将下面这篇英文学术论文（包含期刊来源和摘要）翻译并重写为一篇适合中文读者阅读的专业《工法情报》推文正文。
【排版要求】
1. 必须使用 Markdown 格式排版。
2. 必须包含以下三个核心模块：
   - 🏆 **文献来源** (提取传入文本中的期刊、作者、引用量等硬核信息)
   - 💡 **核心工法解析** (将英文摘要翻译为通顺、专业的中文工程描述，切忌机翻味)
   - 🚀 **应用前景分析** (作为总编，用1段话专业点评该技术在实际造船厂中的潜在应用价值)
3. 语言风格：硬核、专业、干练。绝不要输出多余的寒暄语。`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sws-proxy-secret': 'my-super-secret-key'
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `【论文标题】\n${article.title}\n\n【原始信息】\n${article.content}` }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[aiService] 学术编译请求失败:', { status: response.status, errorData });
      throw new Error(`AI 服务请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.choices?.[0]?.message?.content) {
      let text = data.choices[0].message.content;
      // 清理响应中的推理标签
      const cleanedText = cleanPlainTextResponse(text);
      console.log("[aiService] 学术文献深度编译成功");
      return cleanedText;
    } else {
      console.error('[aiService] AI 服务返回数据格式异常:', data);
      throw new Error('AI 服务返回数据格式异常');
    }
  } catch (error) {
    console.error("[aiService] 学术编译失败:", error);
    throw new Error("编译失败");
  }
}

/**
 * 组装喂给 64K 图谱引擎的超级上下文 (支持 PDF 暴力静默抽字)
 */
export async function buildSuperContextForGraph(articles: any[]): Promise<string> {
    console.log(`[aiService] 开始为 ${articles.length} 篇文章组装超级上下文...`);
    let combinedText = '';

    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        combinedText += `\n\n【${i + 1}. 文献标题】${article.title || '未知标题'}\n`;

        // 核心：如果有 PDF 附件，启动底层 Worker 强行静默抽字！
        if (article.pdfData) {
            console.log(`[aiService] 发现 PDF 核心资产：${article.title}，启动静默抽字...`);
            try {
                // 深度提取前 30 页的核心工法数据
                const pdfResult = await extractAbstractFromPdf(article.pdfData, 30);
                if (pdfResult.success && pdfResult.fullText) {
                    combinedText += `【文献核心全文 (自动抽取)】\n${pdfResult.fullText}\n`;
                    console.log(`[aiService] PDF 抽字成功，获得 ${pdfResult.textLength} 字干货！`);
                } else {
                    combinedText += `【文献摘要】\n${article.abstract || 'PDF 抽字失败，缺乏文本层'}\n`;
                }
            } catch (error) {
                console.warn(`[aiService] PDF 抽字异常，退化为摘要模式：`, error);
                combinedText += `【文献摘要】\n${article.abstract || article.content}\n`;
            }
        } else {
            // 普通文章，直接使用原始正文
            combinedText += `【文献正文】\n${article.content || article.abstract || ''}\n`;
        }
    }

    return combinedText;
}
