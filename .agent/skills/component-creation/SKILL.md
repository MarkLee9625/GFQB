---
name: component-creation
description: 创建新 React 组件的标准模板和流程。当需要新建 UI 组件时使用。
---

# 组件创建指南 (Component Creation)

此 Skill 用于标准化新建 React 组件的流程。

## 何时使用

- 需要添加新的 UI 功能模块时
- 将大型页面拆分为小组件时

## 核心原则

1.  **原子化设计**: 组件应尽量保持单一职责。
2.  **类型优先**: 先定义 Props 接口，再编写组件逻辑。
3.  **样式分离**: 使用 TailwindCSS 直接编写样式，避免行内样式对象（style prop），除非是动态值。

## 标准模板

创建新组件时，请参照以下模板：

```tsx
import React, { useState, useEffect } from 'react';

// 1. 定义 Props 接口
interface ComponentNameProps {
  title: string;
  isActive?: boolean;
  onAction?: (id: string) => void;
  className?: string; // 允许外部传入样式类进行微调
}

// 2. 组件定义 (使用 Named Export)
export const ComponentName: React.FC<ComponentNameProps> = ({
  title,
  isActive = false, // 默认值
  onAction,
  className = '',
}) => {
  // state 定义
  const [internalState, setInternalState] = useState(false);

  // handlers
  const handleClick = () => {
    setInternalState(!internalState);
    if (onAction) {
      onAction('some-id');
    }
  };

  return (
    <div className={`p-4 border rounded ${isActive ? 'bg-blue-50' : 'bg-white'} ${className}`}>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <button 
        onClick={handleClick}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        {internalState ? 'Active' : 'Inactive'}
      </button>
    </div>
  );
};
```

## 文件放置规则

- **通用 UI 组件**: 放入 `src/components/ui/` (如按钮、输入框、模态框)
- **业务组件**: 放入 `src/components/` 下的特定功能文件夹 (如 `src/components/editor/`)
- **页面级组件**: 如果项目有专门的 pages 目录，放入 `src/pages/`；如果是单页应用，通常在 `src/components` 下按大模块划分。

## 常用于此项目的库

- **Styling**: TailwindCSS
- **Icons**: 检查项目中使用的图标库 (通常是 `lucide-react` 或 `heroicons`)
- **State**: React Hooks (useState, useReducer, useContext)
