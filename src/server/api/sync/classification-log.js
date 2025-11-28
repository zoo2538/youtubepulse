/**
 * 분류 로그 저장 API 핸들러
 * 채널의 카테고리 분류 이력을 PostgreSQL에 저장
 */

import { createPostgreSQLService } from '../../lib/postgresql-service-server.js'; // 서버용 서비스 import
// import { parseJsonBody } from '../../middleware/body-parser.js'; // 바디 파서 (가정)

/**
 * [POST] /api/sync/classification-log
 * 채널 분류 로그를 PostgreSQL에 저장
 */
export async function handleSaveClassificationLog(req, res) {
  try {
    // req.body는 ChannelClassificationLog 객체여야 합니다.
    const logEntry = req.body;
    
    if (!logEntry || !logEntry.channelId || !logEntry.category) {
      return res.status(400).json({ error: 'Invalid classification log data' });
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

    // 1. PostgreSQL에 로그 삽입
    await postgresqlService.insertClassificationLog(logEntry);
    
    // 2. 성공 응답
    res.status(200).json({ 
      success: true,
      message: 'Classification log saved successfully' 
    });

  } catch (error) {
    console.error('❌ 분류 로그 저장 API 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '서버 분류 로그 처리 중 오류 발생',
      message: error.message
    });
  }
}

