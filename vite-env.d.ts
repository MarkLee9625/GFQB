/// <reference types="vite/client" />

// 注意：前端不再直接访问 Gemini API，所有请求通过 BFF 代理服务器转发
// 因此不再需要 VITE_GEMINI_API_KEY 环境变量

interface ImportMetaEnv {
    // 保留其他环境变量定义，但移除 VITE_GEMINI_API_KEY
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}