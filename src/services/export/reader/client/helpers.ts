/**
 * 离线阅读器客户端脚本 - 通用助手函数片段
 *
 * 约束（与 graphEngine/Renderer 注入模板同理）：
 * 返回的 ES5 代码字符串内严禁出现反引号与 ${}（会提前闭合外层模板字面量）。
 * 本模块仅做字符串拼装，运行时语义与拆分前完全一致。
 */

export function getClientHelpersCode(): string {
    return `
    function forEach(list, callback) {
        if (!list) return;
        for (var i = 0; i < list.length; i++) {
            callback(list[i], i);
        }
    }

    function escapeForJS(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function findParent(el, cls) {
        while (el && el !== document) {
            if (el.classList && el.classList.contains(cls)) return el;
            el = el.parentNode;
        }
        return null;
    }
`;
}
