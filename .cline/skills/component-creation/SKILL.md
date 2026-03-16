---
name: component-creation
description: 创建新 React 组件的标准模板和流程。当需要新建 UI 组件时使用。
---

# 组件创建指南 (Component Creation)

此 Skill 用于标准化新建 React 组件的流程。基于项目根目录的 `.cursorrules` 文件制定。

## 何时使用

- 需要添加新的 UI 功能模块时
- 将大型页面拆分为小组件时
- 重构大型组件以提高可维护性时

## 核心原则

1.  **原子化设计**: 组件应尽量保持单一职责。如果一个组件超过 200 行，考虑将其拆分为更小的子组件。
2.  **类型优先**: 先定义 Props 接口，再编写组件逻辑。必须避免使用 `any` 类型。
3.  **样式分离**: 使用 TailwindCSS 直接编写样式，避免行内样式对象（style prop），除非是动态值。禁止使用 CSS Modules。

## 标准模板

创建新组件时，请参照以下模板：

```tsx
import React, { useState, useEffect } from 'react';

// 1. 定义 Props 接口（必须避免 any 类型）
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

  // handlers（使用正确的 React 事件类型）
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
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

## 项目特定约束（必须遵守）

### 1. 数据访问规则
- **严禁** 直接在组件中访问 IndexedDB。
- **必须** 使用 `hooks/useJournal.ts` 进行 CRUD 操作。
- 对于复杂的数据库操作，应扩展 `services/db.ts`。

### 2. 图标系统
- **必须** 使用自定义 SVG 图标系统 `<Icon name="..." />` 从 `components/Icons` 导入。
- **严禁** 导入 lucide-react、heroicons、font-awesome 或其他外部图标库。

### 3. 布局结构
- **布局组件**：必须放在 `components/Layout/` 目录下（参考 `MainLayout.tsx`）。
- **业务组件**：按功能组织在相应目录（如 `components/Editor/`, `components/Sidebar/`）。
- **通用 UI 组件**：放入 `components/` 根目录，按功能命名。

### 4. 状态管理
- **必须** 使用 React Hooks (useContext, useReducer)。
- **禁止** 使用 Redux、MobX 或其他第三方状态管理库。

### 5. 重型功能处理
- 添加新的大型文件处理功能时，**必须** 使用 Web Workers 或 `requestIdleCallback`。

## 文件放置规则

- **通用 UI 组件**: 放入 `components/` 根目录（如按钮、输入框、模态框）
- **业务组件**: 放入 `components/` 下的特定功能文件夹（如 `components/Editor/`）
- **布局组件**: **必须** 放在 `components/Layout/` 目录
- **页面级组件**: 如果项目有专门的 pages 目录，放入 `src/pages/`；对于单页应用，通常在 `components` 下按大模块划分

## 导入顺序规范

导入语句必须按以下顺序分组：

```tsx
// React 核心库
import React, { useState, useEffect } from 'react';

// 项目组件
import { Icon } from './components/Icons';
import { Editor } from './components/Editor';

// 项目服务
import { db } from './services/db';

// 工具函数
import { compressImage } from './utils/fileHelpers';

// 类型定义
import { Article } from './types';
```

## 常用于此项目的库

- **Framework**: React + TypeScript + Vite
- **Styling**: TailwindCSS (Utility-first)
- **Icons**: **自定义 SVG 图标系统** - 使用 `<Icon name="..." />` 从 `components/Icons` 导入
- **State**: React Hooks (useState, useReducer, useContext)
- **Persistence**: Local-First via IndexedDB (wrapped in `services/db.ts`)

## 示例：符合项目规范的组件

```tsx
import React from 'react';

// 类型定义优先
interface ArticleCardProps {
  article: Article;
  onClick: (id: number) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick }) => {
  const handleClick = () => {
    onClick(article.id);
  };

  return (
    <div 
      className="p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
      onClick={handleClick}
    >
      <h3 className="text-lg font-bold text-gray-800 mb-2">{article.title}</h3>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span className="px-2 py-1 bg-gray-100 rounded">{article.category}</span>
        <span>{article.date || '未标注日期'}</span>
      </div>
    </div>
  );
};
```


