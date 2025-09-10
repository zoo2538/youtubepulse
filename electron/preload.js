import { contextBridge, ipcRenderer } from 'electron';

// 렌더러 프로세스에서 사용할 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),
  
  // 파일 시스템 (보안을 위해 제한된 기능만)
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  
  // 시스템 정보
  getPlatform: () => process.platform,
  getArch: () => process.arch,
  
  // 앱 제어
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  
  // 알림
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  
  // 데이터베이스 경로
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  
  // 업데이트 체크
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // 로그
  log: (level, message) => ipcRenderer.invoke('log', level, message)
});

// 개발 모드에서 콘솔 로그 활성화
if (process.env.NODE_ENV === 'development') {
  console.log('Electron preload script loaded');
}
