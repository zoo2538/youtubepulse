// Electron API 타입 정의
declare global {
  interface Window {
    electronAPI: {
      // 앱 정보
      getAppVersion: () => Promise<string>;
      getAppName: () => Promise<string>;
      
      // 파일 시스템
      showOpenDialog: (options: any) => Promise<any>;
      showSaveDialog: (options: any) => Promise<any>;
      
      // 시스템 정보
      getPlatform: () => string;
      getArch: () => string;
      
      // 앱 제어
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      
      // 알림
      showNotification: (title: string, body: string) => Promise<void>;
      
      // 데이터베이스 경로
      getAppDataPath: () => Promise<string>;
      
      // 업데이트 체크
      checkForUpdates: () => Promise<any>;
      
      // 로그
      log: (level: string, message: string) => Promise<void>;
    };
  }
}

export {};
