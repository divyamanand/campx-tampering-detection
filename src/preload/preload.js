"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    send: (channel, ...args) => electron_1.ipcRenderer.send(channel, ...args),
    on: (channel, listener) => {
        electron_1.ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    },
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
});
//# sourceMappingURL=preload.js.map