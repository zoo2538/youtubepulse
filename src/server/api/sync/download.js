/**
 * 동기화 다운로드 API 핸들러
 * PostgreSQL에서 증분 데이터를 조회하여 클라이언트에 전송
 */

// 서버 환경에서 필요한 모듈
import { createPostgreSQLService } from '../../lib/postgresql-service-server.js'; // PostgreSQL 서비스

/**
 * [POST] /api/sync/download 라우트 핸들러 함수
 */
export async function handleSyncDownload(req, res) {
  try {
    // 클라이언트가 보낸 lastSyncTime을 받습니다. (JSON Body 파싱 필요)
    const { lastSyncTime } = req.body;
    
    if (!lastSyncTime) {
      return res.status(400).json({ error: 'lastSyncTime is required' });
    }

    // PostgreSQL pool 가져오기
    const pool = req.app.locals.pool;
    if (!pool) {
      return res.status(503).json({ 
        error: 'Database connection not available',
        message: 'PostgreSQL pool이 초기화되지 않았습니다.'
      });
    }

    // 서버용 PostgreSQL 서비스 인스턴스 생성
    const postgresqlService = createPostgreSQLService(pool);

    // 1. PostgreSQL에서 증분 데이터 조회 (가장 중요 ⭐)
    //    * postgresqlService에 getDifferentialData 함수가 구현되어 있어야 합니다.
    const recentData = await postgresqlService.getDifferentialData(lastSyncTime);
    
    // 2. 응답 전송
    res.status(200).json({
      channels: recentData.channels || [],
      videos: recentData.videos || [],
      classificationData: recentData.classificationData || [],
      unclassifiedData: recentData.unclassifiedData || [],
      // ... (클라이언트가 IndexedDB에 저장할 모든 데이터를 여기에 담습니다.)
    });

  } catch (error) {
    console.error('❌ 서버 동기화 API 처리 중 오류:', error);
    res.status(500).json({ error: '서버 동기화 처리 중 오류 발생' });
  }
}

