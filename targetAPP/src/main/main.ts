import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMockApi } from "../server/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let apiServer: Awaited<ReturnType<typeof startMockApi>> | undefined;

async function createWindow() {
  if (!process.env.MOCK_API_BASE) {
    apiServer = await startMockApi(4545);
    process.env.MOCK_API_BASE = apiServer.baseUrl;
  }

  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 680,
    title: "PlateRun",
    backgroundColor: "#f7f3ed",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    await window.loadURL(devServer);
  } else {
    await window.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  apiServer?.server.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
