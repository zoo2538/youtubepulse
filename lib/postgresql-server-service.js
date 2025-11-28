/**
 * 서버용 PostgreSQL 서비스
 * 실제 PostgreSQL 데이터베이스에 연결하여 데이터를 조회/저장
 */

/**
 * 증분 데이터 조회 (lastSyncTime 이후 업데이트된 데이터)
 * @param {Pool} pool - PostgreSQL 연결 풀
 * @param {string|Date} lastSyncTime - 마지막 동기화 시간 (ISO 문자열 또는 Date 객체)
 * @returns {Promise<{channels: any[], videos: any[], classificationData: any[], unclassifiedData: any[]}>}
 */
export async function getDifferentialData(pool, lastSyncTime) {
  if (!pool) {
    throw new Error('PostgreSQL pool이 초기화되지 않았습니다.');
  }

  const client = await pool.connect();
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
 * 서버용 PostgreSQL 서비스 클래스
 * pool을 내부에 저장하여 메서드 호출 시 사용
 */
class PostgreSQLServerService {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * 증분 데이터 조회
   * @param {string|Date} lastSyncTime - 마지막 동기화 시간
   * @returns {Promise<{channels: any[], videos: any[], classificationData: any[], unclassifiedData: any[]}>}
   */
  async getDifferentialData(lastSyncTime) {
    return getDifferentialData(this.pool, lastSyncTime);
  }
}

// CommonJS 호환성
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getDifferentialData,
    PostgreSQLServerService
  };
}
