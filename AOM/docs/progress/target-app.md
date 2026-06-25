# targetAPP 进度

## 当前状态

- `targetAPP/` 已存在 Electron/React demo。
- 根据仓库约束，目标应用必须保持通用消费应用，不添加 AOM 专用后门或隐藏测试控件。
- Phase 1 静态测试只读取 `targetAPP/dist` 构建制品；动态方案使用外部 CDP，不修改目标应用代码。
- 已增加标准 macOS arm64 打包命令 `pnpm dist:mac`，输出 `targetAPP/release/mac-arm64/PlateRun.app`。
- 打包配置使用 ASAR，bundle identifier 为 `com.aom.platerun`；开发态产物未签名。
- `pnpm build` 会先清理 `dist`，避免旧 Vite hash bundle 污染发布包和静态分析。
- Vite 生产资源基址改为 `./`，修复 Electron `file://` 页面无法加载 `/assets/...` 的普通打包问题。
- 修复后真实打包窗口可加载完整 React UI，供 Playwright 动态分析采集 22 个 runtime node；未增加 AOM 专用代码或 selector。

## 近期目标

- 保持 demo App 作为外部目标。
- 后续只做普通产品需求或必要 bug fix，不为 AOM 添加特殊 instrumentation。
- 后续可补产品图标和 Developer ID signing，不影响 AOM 接入方式。
