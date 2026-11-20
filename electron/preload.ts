import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../src/bridge";
const bridge: DesktopBridge = {
  info: () => ipcRenderer.invoke("cuelira:info"),
  consent: (camera, recording) =>
    ipcRenderer.invoke("cuelira:consent", camera, recording),
  list: () => ipcRenderer.invoke("cuelira:list"),
  save: (take) => ipcRenderer.invoke("cuelira:save", take),
  delete: (id) => ipcRenderer.invoke("cuelira:delete", id),
  export: (id, format) => ipcRenderer.invoke("cuelira:export", id, format),
  videoSave: (id, bytes) => ipcRenderer.invoke("cuelira:video-save", id, bytes),
  videoRead: (id) => ipcRenderer.invoke("cuelira:video-read", id),
  openPresagePolicy: () => ipcRenderer.invoke("cuelira:presage-policy"),
};
contextBridge.exposeInMainWorld("cuelira", bridge);
