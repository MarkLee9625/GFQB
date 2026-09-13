/**
 * 离线阅读器客户端脚本组装器 - 保持 `getClientScript()` 签名不变（readerSkeleton.ts 唯一调用方）
 *
 * 实际 ES5 代码已按职责拆分到 `client/*`（Phase 1B 渐进优化），本文件仅按序拼接：
 * helpers（助手函数）→ shell HEAD（app 字段/init）→ media（懒加载）→ render（渲染）
 * → shell TAIL（导航/全屏 + window 挂载）→ boot（解压自举/监听）
 *
 * 约束：各片段内严禁反引号与 ${}；拼接顺序即运行时求值顺序，不得调换。
 */

import { getClientHelpersCode } from './client/helpers';
import { getClientShellHeadCode, getClientShellTailCode } from './client/shell';
import { getClientMediaMethodsCode } from './client/media';
import { getClientRenderMethodsCode } from './client/render';
import { getClientBootCode } from './client/boot';

export function getClientScript() {
    return `
${getClientHelpersCode()}
${getClientShellHeadCode()}
${getClientMediaMethodsCode()}
${getClientRenderMethodsCode()}
${getClientShellTailCode()}
${getClientBootCode()}
`;
}
