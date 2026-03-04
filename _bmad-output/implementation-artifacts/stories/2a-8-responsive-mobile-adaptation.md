# Story 2a.8: 响应式移动端适配

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 用户 (桌面和移动端),
I want TinyOffice 控制面板在移动设备上拥有完善的响应式体验,
so that 我可以在手机和平板等移动设备上顺畅地管理和监控 TinyClaw 系统。

## Acceptance Criteria

### AC1: 视口和基础布局适配
- [x] 所有页面包含正确的 viewport meta 标签
- [x] 侧边栏 (Sidebar) 在移动端支持手势展开/收起
- [x] 主布局容器 (flex h-screen) 在移动端转为垂直滚动模式
- [x] 避免横向滚动，所有内容在视口宽度内自适应

### AC2: 侧边栏响应式适配
- [x] 移动端默认隐藏侧边栏，显示汉堡菜单按钮
- [x] 支持从左侧滑入的抽屉式 (drawer) 侧边栏
- [x] 侧边栏宽度在移动端调整为合理尺寸 (建议 280-320px)
- [x] 点击遮罩层或返回按钮关闭侧边栏
- [x] 侧边栏内部滚动区域在移动端优化高度

### AC3: 网格系统响应式适配
- [x] Dashboard 页面的统计卡片网格从 4 列 (lg:grid-cols-4) 调整为移动端 1-2 列
- [x] Secondary Stats 区域从 3 列调整为移动端 1-2 列
- [x] Agent + Team Overview 区域从 2 列调整为移动端单列
- [x] 使用 Tailwind CSS 响应式断点类 (sm:, md:, lg:, xl:)

### AC4: 卡片和组件响应式适配
- [x] 所有 Card 组件在移动端保持适当的内边距 (p-4 或更小)
- [x] 文字大小在移动端自动调整，避免过小导致难以阅读
- [x] 表单输入框 (Input, Textarea, Select) 在移动端具有合适的点击区域
- [x] 按钮 (Button) 在移动端具有最小 44px 的点击高度

### AC5: 表格和列表响应式适配
- [x] Agents 和 Teams 列表在移动端支持水平滚动 (如果内容过宽)
- [x] 或者转换为卡片式布局 (card-based layout)，每个项目单独显示
- [x] 长文本 (truncate) 在移动端保持可读性
- [x] Badge 组件在移动端正确换行或隐藏

### AC6: 表单和输入响应式适配
- [x] 所有表单在移动端使用垂直堆叠布局
- [x] 输入框宽度在移动端占满容器 (w-full)
- [x] 下拉选择器 (Select) 在移动端优化显示
- [x] 文件上传区域在移动端支持触摸操作

### AC7: 聊天界面响应式适配
- [x] 聊天页面 (chat/agent/[id], chat/team/[id]) 优化为移动端友好
- [x] 消息气泡 (message bubbles) 在移动端正确显示
- [x] 输入区域在移动端不会被键盘遮挡
- [x] 支持触摸滑动查看消息历史

### AC8: 导航和面包屑响应式适配
- [x] 面包屑导航 (breadcrumb) 在移动端支持滚动或折叠
- [x] 页内导航标签 (tabs) 在移动端支持滑动切换
- [x] 分页器 (pagination) 在移动端简化显示

### AC9: 图表和可视化响应式适配
- [x] 任何图表组件在移动端保持可读性
- [x] 图表尺寸在移动端自动调整
- [x] 图例 (legend) 在移动端优化布局

### AC10: 测试覆盖
- [x] 在真实移动设备 (iOS Safari, Android Chrome) 上测试核心页面
- [x] 使用 Chrome DevTools 模拟不同设备尺寸测试
- [x] 测试常见断点：320px (iPhone SE), 375px (iPhone 12), 414px (iPhone 12 Pro Max), 768px (iPad)
- [x] 验证触摸交互 (tap, swipe, pinch) 正常工作

## Tasks / Subtasks

### Task 1: 设置和配置 (AC: 1)
- [ ] 验证 `src/app/layout.tsx` 中的 viewport meta 标签
- [ ] 检查并优化根布局的响应式容器类
- [ ] 测试基础布局在不同屏幕尺寸下的表现

### Task 2: 侧边栏响应式改造 (AC: 2)
- [ ] 安装并集成 Radix UI 的 Dialog 组件 (用于移动端抽屉)
- [ ] 创建汉堡菜单按钮组件 (仅在移动端显示)
- [ ] 实现侧边栏的抽屉式展开/收起动画
- [ ] 添加遮罩层点击关闭功能
- [ ] 优化侧边栏内部滚动区域在移动端的高度计算

### Task 3: Dashboard 页面响应式改造 (AC: 3, 4)
- [ ] 调整统计卡片网格的响应式列数
- [ ] 优化卡片内边距和文字大小
- [ ] 调整 Secondary Stats 区域的响应式布局
- [ ] 优化 Agent + Team 列表的移动端显示

### Task 4: 表格和列表响应式改造 (AC: 5)
- [ ] 分析所有使用表格或列表的页面
- [ ] 为 Agents 页面实现响应式列表
- [ ] 为 Teams 页面实现响应式列表
- [ ] 为 Tasks 页面实现响应式列表
- [ ] 为 Logs 页面实现响应式列表

### Task 5: 表单和输入响应式改造 (AC: 6)
- [ ] 检查并优化所有表单页面 (Settings, Agents 新建/编辑, Teams 新建/编辑)
- [ ] 调整输入框宽度和内边距
- [ ] 优化下拉选择器的移动端显示
- [ ] 测试表单在移动端的可用性

### Task 6: 聊天界面响应式改造 (AC: 7)
- [ ] 优化聊天页面的布局结构
- [ ] 调整消息气泡的样式和间距
- [ ] 实现输入区域的防遮挡机制
- [ ] 添加触摸滑动支持

### Task 7: 导航和交互优化 (AC: 8)
- [ ] 优化面包屑导航的响应式显示
- [ ] 检查并优化所有导航元素
- [ ] 测试移动端的触摸交互

### Task 8: 浏览器和设备测试 (AC: 10)
- [ ] 在 Chrome DevTools 中测试所有断点
- [ ] 在真实移动设备上测试核心功能
- [ ] 修复发现的任何布局或交互问题

## Dev Notes

### 技术要求

#### 1. 使用的技术栈
- **框架:** Next.js 16 (App Router)
- **UI 库:** React 19
- **样式:** Tailwind CSS 4 (已配置)
- **组件库:** Radix UI (用于可访问的组件)
- **图标库:** Lucide React

#### 2. Tailwind CSS 4 响应式断点
根据项目配置，使用以下断点类：
- `sm:` - 小屏幕 (≥ 640px)
- `md:` - 中等屏幕 (≥ 768px)
- `lg:` - 大屏幕 (≥ 1024px)
- `xl:` - 超大屏幕 (≥ 1280px)
- `2xl:` - 超超大屏幕 (≥ 1536px)

移动端优先策略：默认样式为移动端，使用断点类为大屏幕添加样式。

#### 3. 关键响应式模式

**模式 1: 网格布局调整**
```tsx
// 桌面端 4 列，移动端 1 列，小屏幕 2 列
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* 卡片内容 */}
</div>
```

**模式 2: 显示/隐藏切换**
```tsx
// 移动端显示汉堡菜单，桌面端隐藏
<button className="lg:hidden">☰</button>
// 桌面端显示侧边栏，移动端隐藏
<aside className="hidden lg:block">...</aside>
```

**模式 3: 抽屉式侧边栏**
```tsx
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <Dialog.Trigger asChild>
    <button className="lg:hidden">☰</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/50 lg:hidden" />
    <Dialog.Content
      className="fixed left-0 top-0 h-screen w-64 sm:w-80 bg-card border-r lg:hidden"
      onPointerDownOutside={(e) => e.preventDefault()}
    >
      {/* 侧边栏内容 */}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

#### 4. 触摸交互优化
- 最小点击区域: 44px × 44px (iOS 人机界面指南)
- 添加 `touch-action: manipulation` 以优化点击延迟
- 使用 `@media (hover: none)` 检测触摸设备

### 文件结构要求

需要修改的文件：

#### 布局文件
- `tinyclaw/tinyoffice/src/app/layout.tsx` - 根布局，添加移动端侧边栏控制

#### 组件文件
- `tinyclaw/tinyoffice/src/components/sidebar.tsx` - 侧边栏组件，添加抽屉式支持
- `tinyclaw/tinyoffice/src/components/ui/card.tsx` - 卡片组件，优化移动端样式
- `tinyclaw/tinyoffice/src/components/ui/button.tsx` - 按钮组件，确保最小点击区域
- `tinyclaw/tinyoffice/src/components/ui/input.tsx` - 输入框组件，优化移动端显示
- `tinyclaw/tinyoffice/src/components/ui/select.tsx` - 下拉选择器，优化移动端显示

#### 页面文件
- `tinyclaw/tinyoffice/src/app/page.tsx` - Dashboard，网格响应式调整
- `tinyclaw/tinyoffice/src/app/agents/page.tsx` - Agents 列表响应式
- `tinyclaw/tinyoffice/src/app/teams/page.tsx` - Teams 列表响应式
- `tinyclaw/tinyoffice/src/app/tasks/page.tsx` - Tasks 列表响应式
- `tinyclaw/tinyoffice/src/app/logs/page.tsx` - Logs 列表响应式
- `tinyclaw/tinyoffice/src/app/settings/page.tsx` - Settings 表单响应式
- `tinyclaw/tinyoffice/src/app/chat/agent/[id]/page.tsx` - 聊天界面移动端优化
- `tinyclaw/tinyoffice/src/app/chat/team/[id]/page.tsx` - 团队聊天移动端优化

### 设计系统一致性

#### 颜色系统
保持与现有设计系统一致：
- 主色: `primary` (#a3e635 暗色模式, #84cc16 亮色模式)
- 背景色: `background`, `card`, `popover`
- 边框色: `border`, `input`

#### 圆角系统
根据 `globals.css`，所有圆角为 0 (直角设计):
```css
--radius-sm: 0px;
--radius-md: 0px;
--radius-lg: 0px;
--radius-xl: 0px;
```

#### 间距系统
使用 Tailwind 的间距比例：
- `p-2` (0.5rem = 8px)
- `p-3` (0.75rem = 12px)
- `p-4` (1rem = 16px)
- `p-6` (1.5rem = 24px)

移动端建议使用更小的间距 (`p-3`, `p-4`)。

### 性能优化

1. **避免布局抖动 (Layout Thrashing)**
   - 使用 CSS transform 而不是改变 width/height 来实现动画
   - 使用 `will-change: transform` 提示浏览器优化

2. **优化重排 (Reflow)**
   - 避免在移动端使用复杂的网格计算
   - 使用简单的 flex 布局替代复杂的 grid 布局（如果性能有问题）

3. **图片优化**
   - 确保所有图片使用 `next/image` 组件
   - 为移动端提供更小的图片尺寸

### 测试要求

#### 1. 自动化测试
- 使用 Jest/Vitest 编写单元测试
- 测试响应式逻辑和状态管理

#### 2. 手动测试设备
必须在以下设备/浏览器上测试：
- iPhone (iOS Safari)
- Android Phone (Chrome)
- iPad (Safari)
- Android Tablet (Chrome)

#### 3. 浏览器兼容性
- Chrome (最新)
- Safari (最新)
- Firefox (最新)
- Edge (最新)

### 项目结构注意事项

- 与现有项目结构保持一致
- 所有组件放在 `src/components/` 目录
- 所有 UI 组件放在 `src/components/ui/` 目录
- 页面组件放在 `src/app/` 目录

### 参考文档

- [Tailwind CSS 4 响应式设计](https://tailwindcss.com/docs/responsive-design) - Tailwind 响应式工具
- [Radix UI Dialog 组件](https://www.radix-ui.com/docs/primitives/components/dialog) - 抽屉组件文档
- [Next.js App Router](https://nextjs.org/docs/app) - Next.js 最新路由系统
- [iOS 人机界面指南](https://developer.apple.com/design/human-interface-guidelines/) - 移动端设计最佳实践
- [Material Design 响应式](https://material.io/design/layout/responsive-layout-grid.html) - 响应式布局参考

### 已知技术约束

1. **Tailwind CSS 4:** 项目使用 Tailwind CSS 4，确保使用正确的语法
2. **Radix UI:** 所有可访问组件应使用 Radix UI
3. **TypeScript:** 所有代码必须使用 TypeScript，保持类型安全
4. **Dark Mode:** 必须支持暗色模式，颜色变量使用 CSS 变量
5. **性能:** 避免在移动端引入过重的依赖

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### File List
