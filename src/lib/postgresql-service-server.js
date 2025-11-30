/**
 * 서버용 PostgreSQL 서비스
 * 실제 PostgreSQL 데이터베이스에 연결하여 데이터를 조회
 * 서버 환경에서만 사용 (Node.js)
 */

/**
 * 서버용 PostgreSQL 서비스 클래스
 * pool을 주입받아 사용
 */
class PostgreSQLServerService {
  constructor(pool) {
    if (!pool) {
      throw new Error('PostgreSQL pool이 필요합니다.');
    }
    this.pool = pool;
  }

  /**
   * 증분 데이터 조회 (lastSyncTime 이후 업데이트된 데이터)
   * @param {string|Date} lastSyncTime - 마지막 동기화 시간 (ISO 문자열 또는 Date 객체)
   * @returns {Promise<{channels: any[], videos: any[], classificationData: any[], unclassifiedData: any[]}>}
   */
  async getDifferentialData(lastSyncTime) {
    if (!this.pool) {
      throw new Error('PostgreSQL pool이 초기화되지 않았습니다.');
    }

    const client = await this.pool.connect();
    try {
      // lastSyncTime을 Date 객체로 변환
      const syncTime = lastSyncTime instanceof Date 
        ? lastSyncTime 
        : new Date(lastSyncTime);

      // 채널 데이터 조회 (updated_at이 lastSyncTime 이후인 것들)
      const channelsResult = await client.query(`
        SELECT 
          channel_id,
          channel_name,
          description,
          category,
          sub_category,
          youtube_url,
          thumbnail_url,
          created_at,
          updated_at
        FROM channels
        WHERE updated_at > $1 OR created_at > $1
        ORDER BY updated_at DESC
      `, [syncTime]);

      // 영상 데이터 조회 (updated_at이 lastSyncTime 이후인 것들)
      const videosResult = await client.query(`
        SELECT 
          video_id,
          channel_id,
          title,
          description,
          view_count,
          like_count,
          comment_count,
          published_at,
          thumbnail_url,
          duration,
          category,
          sub_category,
          status,
          created_at,
          updated_at
        FROM videos
        WHERE updated_at > $1 OR created_at > $1
        ORDER BY updated_at DESC
      `, [syncTime]);

      // 분류 데이터 조회 (created_at이 lastSyncTime 이후인 것들)
      const classificationResult = await client.query(`
        SELECT 
          id,
          data_type,
          data,
          created_at
        FROM classification_data
        WHERE created_at > $1
        ORDER BY created_at DESC
      `, [syncTime]);

      // 미분류 데이터 조회 (updated_at이 lastSyncTime 이후인 것들)
      const unclassifiedResult = await client.query(`
        SELECT 
          id,
          video_id,
          channel_id,
          channel_name,
          video_title,
          video_description,
          view_count,
          like_count,
          comment_count,
          upload_date,
          collection_date,
          thumbnail_url,
          category,
          sub_category,
          status,
          day_key_local,
          keyword,
          subscriber_count,
          channel_video_count,
          channel_creation_date,
          channel_description,
          created_at,
          updated_at
        FROM unclassified_data
        WHERE updated_at > $1 OR created_at > $1
        ORDER BY updated_at DESC
      `, [syncTime]);

      return {
        channels: channelsResult.rows.map(row => ({
          channelId: row.channel_id,
          channelName: row.channel_name,
          description: row.description,
          category: row.category,
          subCategory: row.sub_category,
          youtubeUrl: row.youtube_url,
          thumbnailUrl: row.thumbnail_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        videos: videosResult.rows.map(row => ({
          videoId: row.video_id,
          channelId: row.channel_id,
          title: row.title,
          description: row.description,
          viewCount: row.view_count,
          likeCount: row.like_count,
          commentCount: row.comment_count,
          publishedAt: row.published_at,
          thumbnailUrl: row.thumbnail_url,
          duration: row.duration,
          category: row.category,
          subCategory: row.sub_category,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        classificationData: classificationResult.rows.map(row => ({
          id: row.id,
          dataType: row.data_type,
          data: row.data,
          createdAt: row.created_at
        })),
        unclassifiedData: unclassifiedResult.rows.map(row => ({
          id: row.id,
          videoId: row.video_id,
          channelId: row.channel_id,
          channelName: row.channel_name,
          videoTitle: row.video_title,
          videoDescription: row.video_description,
          viewCount: row.view_count,
          likeCount: row.like_count,
          commentCount: row.comment_count,
          uploadDate: row.upload_date,
          collectionDate: row.collection_date,
          thumbnailUrl: row.thumbnail_url,
          category: row.category,
          subCategory: row.sub_category,
          status: row.status,
          dayKeyLocal: row.day_key_local,
          keyword: row.keyword,
          subscriberCount: row.subscriber_count,
          channelVideoCount: row.channel_video_count,
          channelCreationDate: row.channel_creation_date,
          channelDescription: row.channel_description,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      };
    } finally {
      client.release();
    }
  }

  /**
   * ✅ 신규 메서드: 분류 로그 삽입
   * @param {Object} logEntry - ChannelClassificationLog 객체
   * @param {string} logEntry.channelId - 채널 ID
   * @param {string} logEntry.category - 카테고리
   * @param {string} logEntry.subCategory - 서브 카테고리
   * @param {string} logEntry.effectiveDate - 유효 시작 날짜 (ISO 문자열)
   * @param {string} logEntry.updatedAt - 업데이트 시간 (ISO 문자열)
   * @param {string} [logEntry.userId] - 분류자 ID (옵션)
   * @returns {Promise<void>}
   */
  async insertClassificationLog(logEntry) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO channel_classification_log (
          channel_id, category, sub_category, effective_date, updated_at, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (channel_id, effective_date) DO UPDATE
        SET category = EXCLUDED.category, 
            sub_category = EXCLUDED.sub_category,
            updated_at = EXCLUDED.updated_at,
            user_id = EXCLUDED.user_id;
      `;
      const values = [
        logEntry.channelId, 
        logEntry.category, 
        logEntry.subCategory, 
        logEntry.effectiveDate, 
        logEntry.updatedAt,
        logEntry.userId || null
      ];
      await client.query(query, values);
      console.log(`✅ 분류 로그 삽입 완료: ${logEntry.channelId}`);
    } catch (error) {
      console.error('❌ 분류 로그 삽입 실패:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✅ 신규 메서드: 오래된 데이터 삭제 (Retention Policy)
   * @param {number} retentionDays - 보관 기간 (일)
   * @returns {Promise<number>} 삭제된 행 수
   */
  async cleanupOldData(retentionDays) {
    const client = await this.pool.connect();
    try {
      // 기준 날짜 계산 (오늘 - retentionDays)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      console.log(`🧹 PostgreSQL 정리 시작: ${cutoffDateStr} 이전 데이터 삭제`);

      // 1. 영상 데이터 삭제 (collection_date 또는 upload_date 기준)
      const videoQuery = `
        DELETE FROM videos 
        WHERE (collection_date < $1 OR (collection_date IS NULL AND upload_date < $1));
      `;
      const videoResult = await client.query(videoQuery, [cutoffDateStr]);
      
      // 2. 통계 데이터 삭제 (선택 사항)
      // const statsQuery = `DELETE FROM daily_stats WHERE date < $1`;
      // await client.query(statsQuery, [cutoffDateStr]);

      console.log(`✅ PostgreSQL 정리 완료: 영상 ${videoResult.rowCount}개 삭제됨`);
      return videoResult.rowCount;
    } catch (error) {
      console.error('❌ PostgreSQL 정리 중 오류:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✅ AI 분석 결과 저장
   * @param {Object} insight - VideoAiInsight 객체
   * @param {string} insight.videoId - 영상 ID
   * @param {string} insight.summary - 3줄 요약
   * @param {string} insight.viralReason - 인기 원인 분석
   * @param {string[]} insight.keywords - 핵심 키워드 배열
   * @param {number} insight.clickbaitScore - 낚시성 점수
   * @param {string} insight.sentiment - 여론/반응
   * @returns {Promise<void>}
   */
  async saveAiInsight(insight) {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO video_ai_insights (
          video_id, summary, viral_reason, keywords, clickbait_score, sentiment
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (video_id) DO UPDATE
        SET summary = EXCLUDED.summary,
            viral_reason = EXCLUDED.viral_reason,
            keywords = EXCLUDED.keywords,
            clickbait_score = EXCLUDED.clickbait_score,
            sentiment = EXCLUDED.sentiment;
      `;
      const values = [
        insight.videoId,
        insight.summary || null,
        insight.viralReason || null,
        insight.keywords || [],
        insight.clickbaitScore || null,
        insight.sentiment || null
      ];
      await client.query(query, values);
      console.log(`✅ AI 분석 결과 저장 완료: ${insight.videoId}`);
    } catch (error) {
      console.error('❌ AI 분석 결과 저장 실패:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✅ AI 분석 결과 조회
   * @param {string} videoId - 영상 ID
   * @returns {Promise<Object|null>} VideoAiInsight 객체 또는 null
   */
  async getAiInsight(videoId) {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          video_id,
          summary,
          viral_reason,
          keywords,
          clickbait_score,
          sentiment,
          created_at
        FROM video_ai_insights
        WHERE video_id = $1
      `;
      const result = await client.query(query, [videoId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        videoId: row.video_id,
        summary: row.summary,
        viralReason: row.viral_reason,
        keywords: row.keywords || [],
        clickbaitScore: row.clickbait_score,
        sentiment: row.sentiment,
        createdAt: row.created_at
      };
    } catch (error) {
      console.error('❌ AI 분석 결과 조회 실패:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * 서버 환경에서 pool을 주입받아 서비스 인스턴스 생성
 * @param {Pool} pool - PostgreSQL 연결 풀
 * @returns {PostgreSQLServerService}
 */
export function createPostgreSQLService(pool) {
  return new PostgreSQLServerService(pool);
}

export { PostgreSQLServerService };

