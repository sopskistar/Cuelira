import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("sdkProbe", {
  info: () => ipcRenderer.invoke("probe:info"),
  consent: (value: boolean) => ipcRenderer.invoke("probe:consent", value),
  onSample: (callback: (sample: unknown) => void) => {
    ipcRenderer.on("probe:sample", (_event, sample) => callback(sample));
  },
});
