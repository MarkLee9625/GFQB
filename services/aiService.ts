/**
 * AI 服务 - 通过 BFF 代理调用 DeepSeek API 进行多种智能处理
 * 注意：API Key 已从客户端移除，通过后端代理进行安全转发
 */

// 使用 DeepSeek Reasoning 模型
const MODEL_NAME = 'deepseek-reasoner';
// 前端通过本地 BFF 代理访问 DeepSeek API，解决跨域和 API Key 安全问题
const API_URL = `/api/deepseek/generate`;

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
 * 提取全局知识图谱
 * @param articlesText 多篇文章的文本内容（建议拼接后传入）
 * @returns Promise<KnowledgeGraphData> 知识图谱数据
 */
export async function extractGlobalKnowledgeGraph(articlesText: string): Promise<KnowledgeGraphData> {
    const systemPrompt = `你是一名船舶工程领域的知识图谱专家。请从用户提供的多篇文章内容中，提取核心技术概念及其关联性，构建知识图谱。

### 【提取要求】
1. **节点识别**：
   - 提取核心技术概念（如：激光焊接、数字孪生、厚板成型等）
   - 提取关键工艺环节（如：涂装、焊接、总装等）
   - 提取重要材料与设备（如：高强度钢、焊接机器人等）
   - 每个节点需分配类型：'technology'、'process'、'material'、'equipment'、'concept'
   - 每个节点需分配权重 (1-10)：根据在文章中出现的频率和重要性

2. **关系识别**：
   - 提取概念之间的关联关系（如：应用、包含、改进、依赖等）
   - 每个关系需描述具体关联（如："激光焊接 应用于 薄板拼接"）
   - 每个关系需分配强度 (1-5)：根据文章中描述的紧密程度

3. **输出格式**：必须输出标准的 JSON 格式，包含 nodes 和 links 数组。

4. **【极度危险警告：严格 JSON 规范，否则系统崩溃】**：
   - 绝对禁止在数组或对象的最后一个元素后添加逗号（严禁尾随逗号）！
   - 必须一次性输出完整的 JSON 结构，确保大括号闭合。
   - 【最关键】：属性名和属性值中，如果需要强调或引用文字，**必须且只能使用中文引号（""或''）**，绝对禁止在字符串内容中出现英文双引号（"），否则将导致 JSON 解析全面崩溃！

### 【输出格式示例】
{
  "nodes": [
    { "id": "node1", "name": "激光焊接", "type": "technology", "weight": 8, "description": "高精度焊接技术" },
    { "id": "node2", "name": "薄板拼接", "type": "process", "weight": 6, "description": "船舶薄板连接工艺" }
  ],
  "links": [
    { "source": "node1", "target": "node2", "relationship": "应用于", "strength": 4 }
  ]
}`;

    const userPrompt = `请从以下文章内容中提取知识图谱：\n\n${articlesText}`;

    try {
        console.log('[aiService] 开始提取知识图谱，文本长度:', articlesText.length);
        
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
            console.error('[aiService] 知识图谱提取请求失败:', { status: response.status, errorData });
            throw new Error(`AI 服务请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
            let text = data.choices[0].message.content;
            // 使用深度清洗函数处理可能的推理标签
            const cleanedText = extractJsonFromReasoning(text);
            
            let graphData: KnowledgeGraphData;
            try {
                graphData = JSON.parse(cleanedText) as KnowledgeGraphData;
            } catch (parseError) {
                console.error('[aiService] JSON 解析致命失败！大模型输出的原始截断字符串为：\n', cleanedText);
                throw new Error('大模型返回的 JSON 格式损坏，请重新点击提取。');
            }
            
            // 验证数据格式
            if (!Array.isArray(graphData.nodes) || !Array.isArray(graphData.links)) {
                throw new Error('知识图谱数据格式异常：缺少 nodes 或 links 数组');
            }
            
            console.log('[aiService] 知识图谱提取成功，节点数:', graphData.nodes.length, '关系数:', graphData.links.length);
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
