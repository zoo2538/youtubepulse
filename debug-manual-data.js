import pg from 'pg';
const { Pool } = pg;

// Railway PostgreSQL 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function debugManualData() {
  let client;
  try {
    client = await pool.connect();
    console.log('🔍 10월 10일 수동수집 데이터 디버깅 시작...\n');

    // 1. classification_data 테이블에서 수동수집 데이터 확인
    console.log('📊 1. classification_data 테이블 - manual_classified 데이터:');
    const manualResult = await client.query(`
      SELECT data_type, created_at, 
             jsonb_array_length(data) as data_count
      FROM classification_data 
      WHERE data_type = 'manual_classified'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    manualResult.rows.forEach(row => {
      console.log(`   - 타입: ${row.data_type}, 생성일: ${row.created_at}, 개수: ${row.data_count}`);
    });

    // 2. 10월 10일 데이터가 있는지 확인
    console.log('\n📊 2. 10월 10일 수동수집 데이터 샘플:');
    const manualDataResult = await client.query(`
      SELECT data FROM classification_data 
      WHERE data_type = 'manual_classified'
      LIMIT 1
    `);
    
    if (manualDataResult.rows.length > 0) {
      const manualData = manualDataResult.rows[0].data;
      const oct10Data = manualData.filter(item => {
        const date = item.dayKeyLocal || item.collectionDate || item.uploadDate;
        return date && date.includes('2025-10-10');
      });
      
      console.log(`   - 전체 수동수집 데이터: ${manualData.length}개`);
      console.log(`   - 10월 10일 데이터: ${oct10Data.length}개`);
      
      if (oct10Data.length > 0) {
        console.log('   - 10월 10일 데이터 샘플:');
        oct10Data.slice(0, 3).forEach(item => {
          console.log(`     * ${item.videoId}: ${item.videoTitle} (${item.collectionType || 'manual'})`);
        });
      }
    }

    // 3. unclassified_data 테이블에서 10월 10일 데이터 확인
    console.log('\n📊 3. unclassified_data 테이블 - 10월 10일 데이터:');
    const unclassifiedResult = await client.query(`
      SELECT COUNT(*) as total_count,
             COUNT(CASE WHEN collection_type = 'manual' THEN 1 END) as manual_count,
             COUNT(CASE WHEN collection_type = 'auto' THEN 1 END) as auto_count
      FROM unclassified_data 
      WHERE collection_date::text LIKE '2025-10-10%'
    `);
    
    console.log(`   - 전체: ${unclassifiedResult.rows[0].total_count}개`);
    console.log(`   - 수동수집: ${unclassifiedResult.rows[0].manual_count}개`);
    console.log(`   - 자동수집: ${unclassifiedResult.rows[0].auto_count}개`);

    // 4. API 응답 시뮬레이션
    console.log('\n📊 4. API 응답 시뮬레이션 (/api/classified?date=2025-10-10):');
    const apiResult = await client.query(`
      SELECT data, data_type FROM classification_data 
      WHERE data_type IN ('auto_collected', 'manual_classified', 'classified') 
      ORDER BY created_at DESC
    `);
    
    let allData = apiResult.rows.flatMap(row => {
      const items = Array.isArray(row.data) ? row.data : [row.data];
      return items.map(item => ({
        ...item,
        _source_type: row.data_type
      }));
    });
    
    // 날짜별 필터링 (10월 10일)
    const filteredData = allData.filter(item => {
      const itemDate = item.dayKeyLocal || item.collectionDate || item.uploadDate;
      const dateStr = itemDate ? itemDate.split('T')[0] : '';
      return dateStr === '2025-10-10';
    });
    
    console.log(`   - 전체 데이터: ${allData.length}개`);
    console.log(`   - 10월 10일 필터링 후: ${filteredData.length}개`);
    
    // 수집 타입별 분류
    const manualData = filteredData.filter(item => !item.collectionType || item.collectionType === 'manual' || item.collectionType === undefined);
    const autoData = filteredData.filter(item => item.collectionType === 'auto');
    
    console.log(`   - 수동수집: ${manualData.length}개`);
    console.log(`   - 자동수집: ${autoData.length}개`);

  } catch (error) {
    console.error('❌ 디버깅 실패:', error);
  } finally {
    if (client) {
      client.release();
    }
    process.exit(0);
  }
}

debugManualData();
