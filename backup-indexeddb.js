
      // IndexedDB 데이터 백업 스크립트
      async function backupIndexedDB() {
        try {
          const dbName = 'YouTubePulseDB';
          const request = indexedDB.open(dbName, 2);
          
          return new Promise((resolve, reject) => {
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction(['unclassifiedData'], 'readonly');
              const store = transaction.objectStore('unclassifiedData');
              const getAllRequest = store.getAll();
              
              getAllRequest.onsuccess = () => {
                const data = {
                  timestamp: new Date().toISOString(),
                  totalRecords: getAllRequest.result.length,
                  records: getAllRequest.result
                };
                
                // 파일로 다운로드
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `indexeddb_backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                console.log(`✅ IndexedDB 백업 완료: ${data.totalRecords}개 레코드`);
                resolve(data);
              };
              
              getAllRequest.onerror = () => reject(getAllRequest.error);
            };
            
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('IndexedDB 백업 실패:', error);
          throw error;
        }
      }
      
      // 실행
      backupIndexedDB().then(data => {
        console.log('백업 완료:', data);
      }).catch(error => {
        console.error('백업 실패:', error);
      });
    