// 데이터 내보내기/가져오기 도구

class DataExportImport {
  private dbName = 'YouTubePulseDB';
  private version = 2;

  // 데이터 내보내기 (개발서버에서 실행)
  async exportData(): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onsuccess = () => {
        const db = request.result;
        const stores = ['unclassifiedData', 'classifiedData', 'dailyProgress', 'channels', 'videos'];
        const data: any = {};
        let completed = 0;
        
        stores.forEach(storeName => {
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            data[storeName] = getAllRequest.result;
            completed++;
            
            if (completed === stores.length) {
              console.log('📤 데이터 내보내기 완료:', data);
              resolve(data);
            }
          };
          
          getAllRequest.onerror = () => {
            console.error(`❌ ${storeName} 내보내기 실패:`, getAllRequest.error);
            reject(getAllRequest.error);
          };
        });
      };
      
      request.onerror = () => {
        console.error('❌ IndexedDB 열기 실패:', request.error);
        reject(request.error);
      };
    });
  }

  // 데이터 가져오기 (도메인에서 실행)
  async importData(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onsuccess = () => {
        const db = request.result;
        const stores = Object.keys(data);
        let completed = 0;
        
        stores.forEach(storeName => {
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          
          // 기존 데이터 삭제
          const clearRequest = store.clear();
          
          clearRequest.onsuccess = () => {
            // 새 데이터 추가
            const items = data[storeName];
            if (items.length === 0) {
              completed++;
              if (completed === stores.length) {
                console.log('📥 데이터 가져오기 완료');
                resolve();
              }
              return;
            }
            
            let added = 0;
            items.forEach((item: any) => {
              const addRequest = store.put(item);
              addRequest.onsuccess = () => {
                added++;
                if (added === items.length) {
                  completed++;
                  if (completed === stores.length) {
                    console.log('📥 데이터 가져오기 완료');
                    resolve();
                  }
                }
              };
              addRequest.onerror = () => {
                console.error(`❌ ${storeName} 항목 추가 실패:`, addRequest.error);
                reject(addRequest.error);
              };
            });
          };
          
          clearRequest.onerror = () => {
            console.error(`❌ ${storeName} 데이터 삭제 실패:`, clearRequest.error);
            reject(clearRequest.error);
          };
        });
      };
      
      request.onerror = () => {
        console.error('❌ IndexedDB 열기 실패:', request.error);
        reject(request.error);
      };
    });
  }
}

// 전역 객체에 추가 (개발자 도구에서 사용)
(window as any).dataExportImport = new DataExportImport();

export default DataExportImport;
