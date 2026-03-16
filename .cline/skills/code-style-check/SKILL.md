---
name: code-style-check
description: 检查代码变更是否符合项目的 TypeScript、React 和 TailwindCSS 规范。在提交代码或进行重构时使用。
---

# 代码风格与质量检查 (Code Style & Quality Check)

此 Skill 用于确保代码符合项目的 TypeScript、React 和 TailwindCSS 规范。基于项目根目录的 `.cursorrules` 文件制定。

## 何时使用

- 编写新组件或修改现有组件后
- 提交代码前进行自我审查
- 重构旧代码时

## 检查清单 (Checklist)

### 1. TypeScript 类型安全（必须遵守）
- [ ] **避免使用 `any`**: 必须定义明确的接口（Interface）或类型（Type）。所有数据模型应定义在 `types.ts` 中。
- [ ] **Props 定义**: 必须为所有组件定义 Props 接口，使用 `interface ComponentNameProps { ... }` 格式。
- [ ] **事件类型**: 为事件处理函数指定正确的 React 事件类型，例如 `React.ChangeEvent<HTMLInputElement>`。
- [ ] **严格检查**: 确保没有明显的未定义（undefined）或空值（null）访问风险，必要时使用可选链 `?.`。
- [ ] **错误处理**: 所有 Promise 必须使用 try/catch 处理错误，关键失败点应添加错误边界。

### 2. React 最佳实践（项目特定）
- [ ] **Hooks 依赖**: `useEffect`, `useCallback`, `useMemo` 的依赖数组必须包含所有引用的外部变量。
- [ ] **组件拆分**: 如果一个组件超过 200 行，考虑将其拆分为更小的子组件（参考 `components/` 目录下的拆分模式）。
- [ ] **Key 属性**: 在列表渲染中，必须使用唯一且稳定的 ID 作为 `key`，**严禁**仅使用数组索引 `index`。
- [ ] **状态管理**: 使用 React Hooks (useContext, useReducer)。**禁止**使用 Redux/MobX。
- [ ] **数据访问**: **禁止**直接在组件中访问 IndexedDB，必须使用 `hooks/useJournal.ts` 进行 CRUD 操作。

### 3. TailwindCSS 样式规范（统一风格）
- [ ] **Class 排序**: 建议按照布局 -> 盒模型 -> 视觉效果的顺序排列类名。
- [ ] **响应式设计**: 检查是否使用了 `md:`, `lg:` 等前缀确保移动端适配。
- [ ] **颜色变量**: 尽量使用 Tailwind 默认色板，避免硬编码十六进制颜色值。
- [ ] **样式分离**: 使用 TailwindCSS 直接编写样式，避免行内样式对象（style prop），除非是动态值。
- [ ] **CSS Modules**: **禁止**使用 CSS Modules，除非是遗留代码。

### 4. 目录结构与命名（符合架构）
- [ ] **文件名**: 组件文件使用 PascalCase (如 `Editor.tsx`)，工具函数使用 camelCase (如 `fileHelpers.ts`)。
- [ ] **导入路径**: 优先使用相对路径。导入分组：React -> 组件 -> 服务 -> 类型。
- [ ] **组件放置**: 
  - 通用 UI 组件：放在 `components/` 根目录
  - 业务组件：按功能组织在相应目录
  - 布局组件：`components/Layout/` 目录
- [ ] **图标系统**: 使用自定义 SVG 图标系统 `<Icon name="..." />` 从 `components/Icons` 导入。**禁止**导入 lucide-react 或 font-awesome。

### 5. 特定行为约束
- [ ] **Editor 组件**: 修改 `Editor.tsx` 时必须保留 `saveSelection`/`restoreSelection` 逻辑以确保光标稳定。
- [ ] **重型功能**: 添加新的大型文件处理功能时，必须使用 Web Workers 或 `requestIdleCallback`。
- [ ] **导出系统**: 修改导出服务时，应修改 `assets.ts` 用于样式，`templates.ts` 用于 HTML 结构。

## 示例

**错误示例:**
```tsx
// 缺少类型定义，使用了 any
const UserCard = ({ user }: any) => {
  return <div className="p-4 bg-red-500">{user.name}</div>;
};
```

**正确示例:**
```tsx
interface User {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface UserCardProps {
  user: User;
  onClick?: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onClick }) => {
  return (
    <div 
      className="p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <h3 className="text-lg font-bold text-gray-800">{user.name}</h3>
    </div>
  );
};
```
