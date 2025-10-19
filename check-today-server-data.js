import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const checkTodayData = async () => {
  try {
    console.log('=== 서버 오늘 데이터 수집 현황 확인 ===');
    
    // 현재 시간 (Asia/Seoul 기준)
    const now = new Date();
    const seoulTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const today = seoulTime.toISOString().split('T')[0];
    
    console.log(`📅 오늘 날짜 (Asia/Seoul): ${today}`);
    
    // 오늘 수집된 미분류 데이터 확인
    const unclassifiedQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN source = 'trending' THEN 1 END) as trending_count,
        COUNT(CASE WHEN source = 'keyword' THEN 1 END) as keyword_count,
        MIN(created_at) as first_collected,
        MAX(created_at) as last_collected
      FROM unclassified_data 
      WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = $1
    `;
    
    const unclassifiedResult = await pool.query(unclassifiedQuery, [today]);
    const unclassifiedData = unclassifiedResult.rows[0];
    
    console.log(`📊 오늘 미분류 데이터: ${unclassifiedData.total_count}개`);
    console.log(`  - Trending: ${unclassifiedData.trending_count}개`);
    console.log(`  - Keyword: ${unclassifiedData.keyword_count}개`);
    console.log(`  - 첫 수집: ${unclassifiedData.first_collected}`);
    console.log(`  - 마지막 수집: ${unclassifiedData.last_collected}`);
    
    // 오늘 수집된 분류된 데이터 확인
    const classifiedQuery = `
      SELECT 
        COUNT(*) as total_count,
        MIN(created_at) as first_collected,
        MAX(created_at) as last_collected
      FROM classified_data 
      WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = $1
    `;
    
    const classifiedResult = await pool.query(classifiedQuery, [today]);
    const classifiedData = classifiedResult.rows[0];
    
    console.log(`📊 오늘 분류된 데이터: ${classifiedData.total_count}개`);
    console.log(`  - 첫 수집: ${classifiedData.first_collected}`);
    console.log(`  - 마지막 수집: ${classifiedData.last_collected}`);
    
    // 최근 7일 데이터 현황
    console.log('\n📅 최근 7일 데이터 현황:');
    for (let i = 0; i < 7; i++) {
      const date = new Date(seoulTime);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayQuery = `
        SELECT 
          COUNT(*) as unclassified_count,
          (SELECT COUNT(*) FROM classified_data 
           WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = $1) as classified_count
        FROM unclassified_data 
        WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') = $1
      `;
      
      const dayResult = await pool.query(dayQuery, [dateStr]);
      const dayData = dayResult.rows[0];
      
      const dayLabel = i === 0 ? ' (오늘)' : '';
      console.log(`  ${dateStr}${dayLabel}: 미분류 ${dayData.unclassified_count}개, 분류 ${dayData.classified_count}개`);
    }
    
    // 마지막 자동 수집 시간 확인
    const lastCollectionQuery = `
      SELECT 
        MAX(created_at) as last_auto_collection
      FROM unclassified_data 
      WHERE source = 'trending'
    `;
    
    const lastCollectionResult = await pool.query(lastCollectionQuery);
    const lastCollection = lastCollectionResult.rows[0].last_auto_collection;
    
    if (lastCollection) {
      const lastCollectionTime = new Date(lastCollection);
      const timeDiff = Math.floor((now - lastCollectionTime) / (1000 * 60)); // 분 단위
      console.log(`\n⏰ 마지막 자동 수집: ${lastCollectionTime.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}`);
      console.log(`⏱️  경과 시간: ${timeDiff}분 전`);
      
      if (timeDiff > 120) { // 2시간 이상
        console.log('⚠️  경고: 자동 수집이 2시간 이상 지연되었습니다.');
      } else {
        console.log('✅ 자동 수집이 정상적으로 작동하고 있습니다.');
      }
    } else {
      console.log('❌ 자동 수집 기록이 없습니다.');
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await pool.end();
  }
};

checkTodayData();


