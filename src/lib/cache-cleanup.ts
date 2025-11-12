// 캐시 및 서비스워커 정리 유틸리티
export class CacheCleanup {
  // 서비스워커 등록 해제 및 캐시 정리
  static async unregisterServiceWorker(): Promise<boolean> {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        for (const registration of registrations) {
          console.log('🗑️ 서비스워커 등록 해제:', registration.scope);
          await registration.unregister();
        }
        
        console.log('✅ 모든 서비스워커 등록 해제 완료');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ 서비스워커 등록 해제 실패:', error);
      return false;
    }
  }

  // 브라우저 캐시 정리
  static async clearBrowserCache(): Promise<boolean> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        
        for (const cacheName of cacheNames) {
          console.log('🗑️ 캐시 삭제:', cacheName);
          await caches.delete(cacheName);
        }
        
        console.log('✅ 모든 브라우저 캐시 정리 완료');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ 브라우저 캐시 정리 실패:', error);
      return false;
    }
  }

  // localStorage 정리 (선택적)
  static clearLocalStorage(keysToKeep: string[] = []): boolean {
    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        console.log('🗑️ localStorage 삭제:', key);
        localStorage.removeItem(key);
      });
      
      console.log('✅ localStorage 정리 완료');
      return true;
    } catch (error) {
      console.error('❌ localStorage 정리 실패:', error);
      return false;
    }
  }

  // 전체 정리 (디버깅용)
  static async fullCleanup(): Promise<{
    serviceWorker: boolean;
    cache: boolean;
    localStorage: boolean;
  }> {
    console.log('🧹 전체 캐시 정리 시작...');
    
    const keysToKeep = [
      'userEmail',
      'userRole',
      'youtubeApiKey',
      'youtubeApiKeys',
      'activeYoutubeApiKeyIndex',
      'youtubeApiEnabled',
      'customApiUrl',
      'customApiEnabled',
      'customApiKey',
      'systemConfig'
    ];
    
    const results = {
      serviceWorker: await this.unregisterServiceWorker(),
      cache: await this.clearBrowserCache(),
      localStorage: this.clearLocalStorage(keysToKeep) // 인증 정보 및 API 설정 보존
    };
    
    console.log('✅ 전체 정리 완료:', results);
    return results;
  }

  // IndexedDB 삭제 시 연관 캐시 자동 삭제 (공통 함수)
  static async clearAssociatedCache(): Promise<void> {
    try {
      console.log('🗑️ IndexedDB 연관 캐시 정리 시작...');
      
      // 1. 서비스 워커 캐시 삭제
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          console.log(`🗑️ 캐시 삭제: ${cacheName}`);
        }
      }

      // 2. 서비스 워커 등록 해제 (선택적)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('🗑️ 서비스 워커 등록 해제:', registration.scope);
        }
      }

      console.log('✅ 연관 캐시 정리 완료');
    } catch (error) {
      console.error('❌ 캐시 정리 실패:', error);
      throw error;
    }
  }

  // 강력한 새로고침 (캐시 무효화)
  static hardRefresh(): void {
    console.log('🔄 강력한 새로고침 실행...');
    
    // 1. 서비스워커 등록 해제
    this.unregisterServiceWorker();
    
    // 2. 캐시 정리
    this.clearBrowserCache();
    
    // 3. 강력한 새로고침
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      // 서비스워커가 있는 경우 skipWaiting + clientsClaim
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // 4. 캐시 무효화 새로고침
    window.location.reload();
  }
}

// 전역에서 사용할 수 있도록 window 객체에 추가
if (typeof window !== 'undefined') {
  (window as any).CacheCleanup = CacheCleanup;
  (window as any).hardRefresh = CacheCleanup.hardRefresh;
  (window as any).clearAllCache = CacheCleanup.fullCleanup;
}
