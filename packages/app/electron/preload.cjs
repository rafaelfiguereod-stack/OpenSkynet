const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFile: () => ipcRenderer.invoke('dialog:selectFile'),
  selectFiles: () => ipcRenderer.invoke('dialog:selectFiles'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => process.platform,

  // Events
  onMessage: (callback) => {
    const subscription = (event, message) => callback(message);
    ipcRenderer.on('main-message', subscription);
    return () => ipcRenderer.removeListener('main-message', subscription);
  },

  sendMessage: (message) => ipcRenderer.send('renderer-message', message),
});
