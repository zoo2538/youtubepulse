import { contextBridge, ipcRenderer } from 'electron';

// 메인 프로세스와 렌더러 프로세스 간 안전한 통신을 위한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보 가져오기
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),
  
  // 플랫폼 정보
  platform: process.platform,
  
  // 개발 모드 확인
  isDev: process.env.NODE_ENV === 'development'
});








