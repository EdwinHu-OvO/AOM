# harderTestApp 真实应用静态分析实验

## 范围与安全边界

- 输入：`harderTestApp/哔哩哔哩.app`
- 方式：只读静态检查。
- 未启动应用，未执行包内脚本或 native module。
- 使用 AOM `ArtifactParser`、Electron static adapter 和只读 ASAR header 解析进行交叉验证。

## ArtifactParser 结果

整包输入：

```text
containerType: mac_app_bundle
runtimeCandidates:
  electron: 0.99
  generic_web: 0.65
recommendedAdapter: adapter:electron-artifact
```

主要 Evidence：

- `Contents/Resources/app.asar`
- `Electron Framework.framework`
- HTML、JavaScript、V8 context snapshot 和 Chrome pak 资源

只输入主可执行文件时：

```text
containerType: mach_o
architecture: universal
runtimeCandidates:
  unknown: 0.0
```

系统工具进一步确认该包实际只包含 arm64 slice。这个差异说明当前 magic detector 只能识别 fat Mach-O 容器，尚未展开 architecture table。

## Electron Adapter 结果

当前 Electron static adapter 对整包输出：

```text
artifacts: 12
nodes: 13
edges: 12
process components: shared
API endpoints: 0
module dependencies: 0
```

该结果只覆盖 `.app` 外壳。Adapter 能看到 `app.asar`，但尚未读取 ASAR index，因此没有构建真实的 main、preload、renderer 和 native module 图。

## ASAR 只读交叉验证

`app.asar`：

- 物理大小：72,710,810 bytes。
- ASAR header：2,068,872 bytes。
- 逻辑文件：7,928。
- 逻辑内容大小：70,641,930 bytes。
- 应用名：`bilibili`。
- 应用版本：`1.16.2`。
- 根入口：`index.js`。
- 主进程入口：`main/index.js`。

顶层结构：

| 区域 | 文件数 | 解释 |
| --- | ---: | --- |
| `node_modules` | 7,640 | bundled dependencies |
| `render` | 271 | renderer pages and assets |
| `main` | 13 | main process, preload and bridge assets |

主要文件类型：

| 类型 | 数量 |
| --- | ---: |
| JavaScript | 4,391 |
| source map | 1,445 |
| JSON | 564 |
| TypeScript | 420 |
| CSS | 28 |
| HTML | 23 |
| native `.node` | 19 |

## 推断出的组件网络

```text
macOS app bundle
  -> arm64 Electron launcher
  -> Electron Framework
  -> app.asar
      -> root bootstrap: index.js
      -> main process: main/index.js
          -> preload: main/assets/bili-preload.js
          -> bridge: main/assets/bili-bridge.js
          -> helper/inject assets
      -> renderer
          -> main UI: render/index.html
          -> login: render/login.html
          -> player: render/player.html
          -> search, tracker, license and other pages
          -> compiled JS/CSS assets
      -> native capability modules
          -> mission-control
          -> mac permissions
          -> HID
          -> automation/input support
```

Renderer asset names include Vue runtime and Vue export helper artifacts, so Vue is a strong renderer-framework candidate. Main, preload and bridge bundles are obfuscated, therefore static symbol and IPC extraction confidence is currently low.

## 其他观察

- `Info.plist` bundle identifier：`com.bilibili.bilibiliPC`。
- 应用版本：`1.16.2.4058`。
- URL scheme：`bilipc`。
- Electron ASAR integrity metadata exists.
- App Transport Security permits arbitrary loads and local networking.
- renderer 包含独立 login、player、search 等页面。
- player 页面引用远程 player、tracking 和 captcha scripts。

## 结论

AOM 当前已证明：

- 能从未知真实 `.app` 自动识别 macOS bundle。
- 能以高置信度识别 Electron 并选择正确 Adapter。
- 能在不知道技术栈的情况下保守处理单独 Mach-O。

## ASAR 修复后回归

集成 ASAR virtual filesystem 后：

```text
artifacts: 317
nodes: 668
edges: 1,175
process components:
  bootstrap
  main
  renderer
package dependencies: 348
native modules: 20
HTML asset edges: 111
```

Adapter 没有展开全部 7,928 个文件节点。应用区文件、HTML 页面和 native binary 保留为 artifact；`node_modules` 汇总为 package 级依赖。

AOM 当前尚不能：

- 解开混淆后的 main/preload/bridge 符号和 IPC channel。
- 从 fat Mach-O header 展开实际 architecture slices。
- 验证 `Info.plist` 中声明的 ASAR integrity hash。

## 后续实现优先级

1. 对未混淆 bundle 提取 import、endpoint 和 IPC；混淆文件保留低置信度 opaque component。
2. 增加轻量混淆检测和 confidence 标记。
3. 扩展 Mach-O detector，解析 fat header architecture table。
4. 校验 Electron ASAR integrity metadata。
