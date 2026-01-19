---
name: code-style-check
description: 检查代码变更是否符合项目的 TypeScript、React 和 TailwindCSS 规范。在提交代码或进行重构时使用。
---

# 代码风格与质量检查 (Code Style & Quality Check)

此 Skill 用于确保代码符合项目的最佳实践和规范。

## 何时使用

- 编写新组件或修改现有组件后
- 提交代码前进行自我审查
- 重构旧代码时

## 检查清单 (Checklist)

### 1. TypeScript 类型安全
- [ ] **避免使用 `any`**: 尽量定义明确的接口（Interface）或类型（Type）。
- [ ] **Props 定义**: 必须为所有组件定义 Props 接口，例如 `interface Props { ... }`。
- [ ] **事件类型**: 为事件处理函数指定正确的 React 事件类型，例如 `React.ChangeEvent<HTMLInputElement>`。
- [ ] **Strict Checks**: 确保没有明显的未定义（undefined）或空值（null）访问风险，必要时使用可选链 `?.`。

### 2. React 最佳实践
- [ ] **Hooks 依赖**: `useEffect`, `useCallback`, `useMemo` 的依赖数组必须包含所有引用的外部变量（可以使用 ESLint 规则辅助检查）。
- [ ] **组件拆分**: 如果一个组件超过 200 行，考虑将其拆分为更小的子组件（参考 `src/components` 目录下的拆分模式）。
- [ ] **Key 属性**: 在列表渲染中，必须使用唯一且稳定的 ID 作为 `key`，**严禁**仅使用数组索引 `index`（除非列表是静态的且不重新排序）。

### 3. TailwindCSS 样式规范
- [ ] **Class 排序**: 建议按照布局 -> 盒模型 -> 视觉效果的顺序排列类名（或遵循 Prettier 插件的自动排序）。
- [ ] **响应式设计**: 检查是否使用了 `md:`, `lg:` 等前缀确保移动端适配。
- [ ] **颜色变量**: 尽量使用 Tailwind 默认色板或 `tailwind.config.js` 中定义的自定义颜色，避免硬编码十六进制颜色值。

### 4. 目录结构与命名
- [ ] **文件名**: 组件文件使用 PascalCase (如 `MyComponent.tsx`)，工具函数使用 camelCase (如 `utils.ts`)。
- [ ] **导入路径**: 优先使用相对路径或别名（如果配置了 path alias）。

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
