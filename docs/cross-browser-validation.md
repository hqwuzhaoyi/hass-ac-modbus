# Cross-Browser Validation Checklist

Use this guide when verifying the enhanced monitoring UI across browsers.

## Supported Targets
- **Desktop**: Chrome ≥ 120, Firefox ≥ 120, Edge ≥ 120, Safari ≥ 17.
- **Mobile Simulation**: Chrome DevTools device emulation (iPhone 14, Pixel 7).

## Steps
1. Start a WebSocket mode (`npm run ws`, `npm run ws:enhanced`, or `npm run ws:demo`) and the Next.js UI (`npm run dev`).
2. Open `http://localhost:3002` (basic) and `http://localhost:3002/enhanced` in each browser.
3. Verify:
   - “实时寄存器变化”卡片加载成功，连接徽章状态一致。
   - 缓冲/依赖卡片排版在不同 viewport 下保持两列自适应（检查 320px、768px、1440px）。
   - 变更条目在高亮后 3 秒渐隐，屏幕阅读器（VoiceOver/NVDA）能朗读变更描述。
   - Demo 模式下回放事件带有蓝色侧边栏，实时事件为橙色；手动“清空历史”按钮在 hover/focus 下可用。
4. 浏览器特性：
   - 在 Firefox 中确认 `aria-live` 信息仍触发（可启用 Accessibility Inspector）。
   - 在 Safari 中观察 CSS 动画是否平滑，无渐隐残影。
5. 如果发现兼容性问题，记录在 issue tracker，并附导航器 UA、截图或控制台错误。

## Automation Hooks
While the project does not ship headless UI tests yet, the component structure (`components/real-time-change-monitor.tsx`, `components/change-history-panel.tsx`) is compatible with Playwright should automated cross-browser coverage be added later.
