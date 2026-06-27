# Adapter Host 进度

## 当前状态

- Phase 1 核心骨架已建立。
- Phase 1 Adapter Host 链路已完成：Rust Host 可自动路由并通过 stdio JSONL 管理 TypeScript Electron Analyzer 子进程。

## 已完成

- 新增 Rust crate：`aom-adapter-host`。
- 实现 `TargetManager`，负责目标注册、查询和移除。
- 将采集拆分为 `StaticAnalysisAdapter` 和 `RuntimeProbe` 两种独立接口。
- 实现 `StaticAdapterManager`、`RuntimeProbeManager`、`SnapshotCollector`、`RawEventBus`、`ActionExecutor`。
- `RawEventBus` 对每个 target 强制 sequence 单调递增。
- Adapter Host 只路由静态快照、动态快照、事件与动作，不暴露 Agent 接口。
- 新增前置 `ArtifactParser`，可识别目录、macOS app bundle、PE、Mach-O、ELF、ZIP、ASAR、APK 和 AppImage。
- 新增 Electron、CEF、WebView2、NW.js、Tauri、Qt WebEngine、Generic Web runtime fingerprints。
- `ArtifactInspection` 输出候选 runtime、confidence、recommended adapter 和逐条检测 Evidence。
- `AdapterHost.inspect_artifact()` 已作为静态 Adapter 之前的统一入口。
- 新增只读 CLI：`cargo run -p aom-adapter-host --bin aom-inspect-artifact -- <path>`，输出 JSON `ArtifactInspection`。
- Electron Adapter 已增加只读 ASAR virtual filesystem，支持 packed/unpacked entry 和不同 Pickle padding。
- ASAR graph 会恢复 package entrypoint、main/preload/renderer/backend、HTML assets、JS imports、API endpoint、package dependency 和 native module。
- `node_modules` 只汇总为 package 级依赖节点；仅 native binary 保留独立 artifact，避免真实 App 图规模失控。
- ASAR reader 限制 header、entry 数量和单文件采样大小，并拒绝越界 offset、partial read 和路径穿越。
- `@electron/asar` 已成为默认 ASAR backend；内部 reader 保留为显式 fallback 和测试 oracle。
- `@electron/fuses` 已提供只读 fuse wire 检测，结果和工具 provenance 写入 root artifact metadata 与 snapshot Evidence ID。
- 定义 `AnalyzerToolDescriptor`：工具 ID、名称、版本、mode 和 capabilities。
- `playwright` 已提供打包 Electron 启动、renderer 选择和 CDP session；真实 PlateRun 已完成 runtime snapshot 与 `set_text` 动作。
- `chrome-remote-interface` 已封装为 `CdpClient`，用于后续连接已有 remote-debugging endpoint。
- 现有原生 WebSocket CDP client 继续保留为协议原型和 fallback。
- 工具链全部局部安装在 `@aom/electron-probe`，未安装全局 npm package，也未下载额外 Playwright browser。
- 真实登录流程已验证 snapshot -> object-addressed action -> event -> new snapshot：22 nodes 增长到 142 nodes，三个动作全部成功。
- Network CDP Evidence 已改为结构化摘要；authorization/cookie/API key 脱敏，请求正文不进入 RawEvent。
- 新增跨语言 `AnalyzerCommand` / `AnalyzerReply`，不使用 generic JSON 作为内部命令协议。
- 新增 `StdioAnalyzerClient`、静态/动态 proxy、`AnalyzerRegistry` 和 `EvidenceStore`。
- Host 负责 Analyzer 子进程启动、stdio、错误映射和关闭；静态与动态 proxy 共享同一进程。
- Parser 路由闭环：Electron、generic Web 和 unknown generic artifact 都有实际 Adapter。
- `adapter:web-artifact` 可分析构建目录；未知单文件可降级输出 opaque artifact，不因无法识别而中断。
- `Runtime.evaluate.exceptionDetails` 现会返回失败动作，不再误报 `ok: true`。
- `RawEventBus` 已按 target 分区，整批 sequence 校验后原子提交，只 drain 当前 target。
- 动态 snapshot/event/action reply 均携带 Playwright 名称、版本、来源和 metadata，Host 保存完整 Evidence。
- Target lifecycle 已进入协议与 Electron Analyzer：`attach_existing` 通过 CDP endpoint
  连接已运行应用，session close 只断开调试连接；`launch_owned` 才允许 AOM 关闭自己启动
  的进程；`copy_for_static_analysis` 表示只做副本/离线静态分析，不创建 runtime session。
- AnalyzerSession 初始化时如果声明 `attach_existing` 但没有 `cdpUrl` 会直接失败，不会回退
  到 `executablePath` 重新启动用户应用。
- AnalyzerSession 会在 `attach_existing` 或 `copy_for_static_analysis` 且存在
  `artifactLocator` 时复制 artifact 到临时目录，再把静态 Adapter 指向副本；session
  close 时清理副本，避免静态扫描锁定或修改用户正在运行的程序包。

## 近期目标

- 扩展 Mach-O format detector，展开 fat header 的 architecture slices。
- 将 analyzer manifest 扩展为输入类型、输出类型、权限需求和可用性探测。
- 增加 Electron archive integrity verification，将校验结果写入一等 Evidence。
- 增加 target/probe 状态事件和断线重连。
- 将 attach-existing CDP discovery 接入 Adapter Host registry，并补真实已运行 PlateRun
  attach trace。
- 增加自动重启、超时取消和多 Analyzer 进程池；这些属于后续可靠性增强，不阻塞 Phase 1 MVP。
