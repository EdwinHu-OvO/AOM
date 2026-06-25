# targetAPP macOS 打包与静态分析实验

## 目标

将通用 `targetAPP` 打包为真实 macOS Electron `.app`，再用与 harderTestApp 相同的 AOM 分析流程验证：

- 未打包构建目录与打包制品的信息差异。
- `ArtifactParser` 对自有 App 的 framework detection。
- 当前 Electron Adapter 在 ASAR 边界上的信息损失。
- ASAR reader 能恢复的结构。

## 打包

新增普通产品构建命令：

```bash
cd targetAPP
pnpm dist:mac
```

产物：

```text
targetAPP/release/mac-arm64/PlateRun.app
```

打包信息：

- platform：macOS。
- architecture：arm64。
- bundle identifier：`com.aom.platerun`。
- version：`0.1.0`。
- Electron：`41.1.1`。
- App 大小：约 293 MB。
- `app.asar`：约 30 MB。
- 开发态未签名，使用 Electron 默认图标。

打包过程发现历史 Vite hash bundle 会因 `emptyOutDir: false` 残留。构建命令已增加跨平台 `dist` 清理步骤，避免旧 renderer bundle 被打入 ASAR。

后续动态回归又发现 Vite 默认生成 `/assets/...` 绝对路径，Electron `file://` 页面无法加载 renderer bundle。生产配置已增加 `base: "./"`，这是普通 Electron 打包修复，不包含 AOM instrumentation。

## ArtifactParser 结果

```text
containerType: mac_app_bundle
runtimeCandidates:
  electron: 0.99
  generic_web: 0.65
recommendedAdapter: adapter:electron-artifact
```

Evidence 与 harderTestApp 一致：

- `Contents/Resources/app.asar`
- `Electron Framework.framework`
- HTML、JavaScript、V8 context snapshot 和 Chrome pak 资源

## Electron Adapter 对比

### 未打包 `targetAPP/dist`

```text
artifacts: 10
nodes: 29
edges: 33
process components:
  main
  renderer
  backend
API endpoints: 7
module dependencies: 9
```

识别 endpoint：

- `/api/addresses`
- `/api/categories`
- `/api/login`
- `/api/me`
- `/api/orders`
- `/api/stores`
- `/api/stores/:id`

### 打包 `PlateRun.app`

```text
artifacts: 5
nodes: 6
edges: 5
process components:
  shared
API endpoints: 0
module dependencies: 0
```

当前 Adapter 只看到 `.app` 外壳和 `app.asar` 文件，无法读取 ASAR 内部结构。

## ASAR 只读验证

清理后 ASAR：

- header：1,028,744 bytes。
- 逻辑文件：3,970。
- 逻辑内容：30,083,351 bytes。
- `node_modules`：3,960 个文件。
- 应用文件：9 个，加根 `package.json`。
- native module：0。

应用结构：

```text
package.json
  -> main: dist/main/main.js
      -> electron
      -> node:path
      -> node:url
      -> dist/server/server.js
  -> preload: dist/main/preload.js
  -> renderer: dist/renderer/index.html
      -> assets/index--kdchiTe.js
      -> assets/index-DzJZuX6s.css
  -> backend
      -> dist/server/server.js
      -> dist/server/data.js
      -> express
      -> cors
```

仅从 ASAR 内应用 JS 即可重新发现全部 API endpoint 和模块依赖。

## 与 harderTestApp 对比

| 指标 | PlateRun | harderTestApp |
| --- | ---: | ---: |
| App 大小 | 293 MB | 288 MB |
| ASAR 大小 | 30 MB | 69 MB |
| ASAR 文件 | 3,970 | 7,928 |
| renderer HTML | 1 | 23 |
| native modules | 0 | 19 |
| main/preload 混淆 | 无 | 强混淆 |
| framework detection | Electron 0.99 | Electron 0.99 |

## 修复后回归

集成 ASAR virtual filesystem 后：

```text
artifacts: 15
nodes: 103
edges: 122
process components:
  main
  renderer
  backend
API endpoints: 7
package dependencies: 78
HTML asset edges: 2
```

Adapter 直接从 ASAR 恢复 `package.json` entrypoint、应用文件、进程角色、HTML script/style、模块依赖和全部 API。`node_modules` 不逐文件展开，而是汇总为 package 级节点。

## 结论

- 前置 `ArtifactParser` 对简单与复杂 Electron App 都能稳定识别和路由。
- 修复前打包会让结构覆盖从 29 nodes 降到 6 nodes。
- ASAR virtual reader 修复后生成 103 nodes，并恢复 main、preload、renderer、backend、endpoint 和 dependency 网络。
- 归档内容在内存中按 offset 有界读取，没有解包到临时目录。
- 默认归档 backend 已切换为 `@electron/asar`，图规模保持 15 artifacts、103 nodes、122 edges。
- `@electron/fuses` 可读取 PlateRun 的九个 V1 fuse。
- 修复相对资源路径后，Playwright 动态 Adapter 可采集 22 个 runtime node 并执行协议动作。
