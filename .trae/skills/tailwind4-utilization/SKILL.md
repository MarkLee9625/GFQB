---
name: tailwind4-utilization
description: 指导如何充分利用Tailwind CSS 4的新功能，如@theme指令、逻辑运算符、新的颜色系统等。
---

# Tailwind CSS 4 使用指南 (Tailwind CSS 4 Utilization)

此 Skill 用于指导如何在项目中充分利用 Tailwind CSS 4 的新功能，提升样式开发效率和代码质量。

## 何时使用

- 升级到 Tailwind CSS 4 后
- 需要优化样式代码结构
- 实现更复杂的样式逻辑
- 提升样式开发效率

## 1. @theme 指令

Tailwind CSS 4 引入了 `@theme` 指令，允许您在 CSS 文件中定义和覆盖主题变量。

### 基本用法
```css
/* tailwind.config.css */
@theme {
  --color-primary: #3b82f6;
  --color-secondary: #6366f1;
  --font-sans: 'Inter', sans-serif;
  --radius-lg: 0.75rem;
}
```

### 适用场景
- 统一管理颜色、字体等主题变量
- 覆盖默认主题设置
- 创建自定义主题

## 2. 逻辑运算符

Tailwind CSS 4 支持在类名中使用逻辑运算符，使样式代码更加灵活。

### 基本用法
```html
<!-- 逻辑与：同时满足两个条件 -->
<div class="md:&hover:bg-blue-500">
  鼠标悬停时且在中等屏幕及以上时背景为蓝色
</div>

<!-- 逻辑或：满足任一条件 -->
<div class="hover:|focus:bg-blue-500">
  鼠标悬停或获取焦点时背景为蓝色
</div>

<!-- 逻辑非：不满足条件 -->
<div class="not-[:last-child]:mb-4">
  不是最后一个子元素时添加 margin-bottom
</div>
```

### 适用场景
- 复杂的条件样式
- 响应式设计
- 状态管理

## 3. 新的颜色系统

Tailwind CSS 4 改进了颜色系统，提供了更灵活的颜色定义方式。

### 基本用法
```css
/* tailwind.config.css */
@theme {
  --color-brand: {
    50: #f0f9ff;
    100: #e0f2fe;
    200: #bae6fd;
    300: #7dd3fc;
    400: #38bdf8;
    500: #0ea5e9;
    600: #0284c7;
    700: #0369a1;
    800: #075985;
    900: #0c4a6e;
  };
}
```

### 适用场景
- 创建品牌色系统
- 统一颜色管理
- 实现渐变色

## 4. 容器查询

Tailwind CSS 4 支持容器查询，允许您根据父容器的尺寸应用样式。

### 基本用法
```html
<div class="container">
  <div class="@container">
    <div class="@md:bg-blue-500">
      当父容器宽度达到 md 断点时背景为蓝色
    </div>
  </div>
</div>
```

### 适用场景
- 组件级响应式设计
- 复杂布局
- 可复用组件

## 5. 改进的工具类

Tailwind CSS 4 提供了更多实用的工具类，简化样式开发。

### 常用工具类
- **text-balance**: 平衡文本换行
- **scroll-smooth**: 平滑滚动
- **backdrop-blur**: 背景模糊效果
- **aspect-video**: 视频比例
- **object-cover**: 图片覆盖

### 示例
```html
<div class="text-balance">
  这段文本会自动平衡换行，使每一行的长度更加均匀
</div>

<div class="scroll-smooth">
  点击链接时会平滑滚动到目标位置
</div>

<div class="backdrop-blur-md bg-white/50">
  半透明背景模糊效果
</div>
```

## 6. 自定义工具类

Tailwind CSS 4 允许您创建自定义工具类，简化重复的样式代码。

### 基本用法
```css
/* tailwind.config.css */
@theme {
  --utilities: {
    'card': 'bg-white rounded-lg shadow-md p-4',
    'btn-primary': 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600',
    'btn-secondary': 'bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300',
  };
}
```

### 适用场景
- 重复使用的样式组合
- 组件样式标准化
- 代码简化

## 7. 性能优化

Tailwind CSS 4 提供了多种性能优化选项，减少 CSS 文件大小。

### 优化策略
- **JIT 模式**: 默认启用，只生成使用的 CSS 类
- **树摇**: 移除未使用的样式
- **CSS 压缩**: 生产环境自动压缩
- **按需加载**: 只加载需要的样式

### 配置示例
```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  future: {
    hoverOnlyWhenSupported: true,
  },
}
```

## 8. 与框架集成

Tailwind CSS 4 与现代前端框架（如 React、Vue、Angular）的集成更加紧密。

### React 集成示例
```tsx
// src/components/Button.tsx
import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  children, 
  onClick 
}) => {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

## 最佳实践

1. **类名排序**: 按照布局 -> 盒模型 -> 视觉效果的顺序排列类名
2. **响应式设计**: 优先使用移动优先的响应式设计
3. **语义化**: 使用有意义的类名，避免过于复杂的组合
4. **代码组织**: 将重复的样式组合抽象为自定义工具类
5. **性能监控**: 定期检查生成的 CSS 文件大小

## 迁移指南

1. **更新依赖**: 将 Tailwind CSS 更新到 4.0.0 或更高版本
2. **配置文件**: 更新 `tailwind.config.js` 配置
3. **代码审查**: 检查现有代码是否可以使用新特性优化
4. **测试**: 确保所有样式在新版本下正常工作

## 常见问题

### Q: Tailwind CSS 4 与 Tailwind CSS 3 有什么主要区别？
**A:** Tailwind CSS 4 引入了 `@theme` 指令、逻辑运算符、改进的颜色系统、容器查询等新功能，同时优化了性能和开发体验。

### Q: 如何处理 Tailwind CSS 4 中的浏览器兼容性问题？
**A:** 您可以使用 `future` 配置选项，如 `hoverOnlyWhenSupported: true`，来确保样式在不同浏览器中的兼容性。

### Q: 如何优化 Tailwind CSS 4 的性能？
**A:** 启用 JIT 模式，合理使用工具类，避免过度使用变体，定期清理未使用的样式。