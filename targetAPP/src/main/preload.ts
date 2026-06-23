import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("nativeApp", {
  apiBase: process.env.MOCK_API_BASE ?? "http://127.0.0.1:4545"
});
