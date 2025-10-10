import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = "postgresql://postgres:BlGEBWGugDMYSVxHZXgXKOEoWpmXjyhy@shortline.proxy.rlwy.net:25302/railway?sslmode=disable";

async function checkServerData() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });

  try {
    console.log('🔌 데이터베이스 연결 중...');
    const client = await pool.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. classification_data 테이블 확인
    console.log('📊 classification_data 테이블 확인:');
    const classificationResult = await client.query(`
      SELECT data_type, created_at, 
             CASE 
               WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data)
               ELSE 1 
             END as item_count
      FROM classification_data 
      ORDER BY created_at DESC
    `);
    
    if (classificationResult.rows.length === 0) {
      console.log('❌ classification_data 테이블이 비어있습니다!');
    } else {
      console.log(`✅ classification_data 테이블: ${classificationResult.rows.length}개 레코드`);
      classificationResult.rows.forEach(row => {
        console.log(`  - ${row.data_type}: ${row.item_count}개 항목, 생성일: ${row.created_at}`);
      });
    }
    console.log('');

    // 2. unclassified_data 테이블 확인
    console.log('📊 unclassified_data 테이블 확인:');
    const unclassifiedResult = await client.query(`
      SELECT 
        day_key_local,
        collection_type,
        status,
        COUNT(*) as count
      FROM unclassified_data
      WHERE day_key_local IN ('2025-10-09', '2025-10-10')
      GROUP BY day_key_local, collection_type, status
      ORDER BY day_key_local DESC, collection_type, status
    `);
    
    if (unclassifiedResult.rows.length === 0) {
      console.log('❌ 10월 9일, 10일 데이터가 없습니다!');
    } else {
      console.log(`✅ unclassified_data 테이블 (10월 9-10일):`);
      unclassifiedResult.rows.forEach(row => {
        console.log(`  - ${row.day_key_local} | ${row.collection_type} | ${row.status}: ${row.count}개`);
      });
    }
    console.log('');

    // 3. 전체 unclassified_data 통계
    console.log('📊 unclassified_data 전체 통계:');
    const totalResult = await client.query(`
      SELECT 
        day_key_local,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'classified' THEN 1 END) as classified,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'unclassified' THEN 1 END) as unclassified
      FROM unclassified_data
      GROUP BY day_key_local
      ORDER BY day_key_local DESC
      LIMIT 10
    `);
    
    console.log('최근 10일 통계:');
    totalResult.rows.forEach(row => {
      console.log(`  ${row.day_key_local}: 전체 ${row.total}개 (분류: ${row.classified}, 미분류: ${row.unclassified}, 보류: ${row.pending})`);
    });
    console.log('');

    // 4. 10월 9일 데이터 샘플 확인
    console.log('📊 10월 9일 데이터 샘플 (상위 5개):');
    const oct9Sample = await client.query(`
      SELECT video_id, video_title, category, sub_category, status, collection_type, view_count
      FROM unclassified_data
      WHERE day_key_local = '2025-10-09'
      ORDER BY view_count DESC
      LIMIT 5
    `);
    
    oct9Sample.rows.forEach(row => {
      console.log(`  - [${row.status}] ${row.video_title?.substring(0, 30)}... | ${row.category}>${row.sub_category} | ${row.collection_type} | 조회수: ${row.view_count}`);
    });
    console.log('');

    // 5. 10월 10일 데이터 샘플 확인
    console.log('📊 10월 10일 데이터 샘플 (상위 5개):');
    const oct10Sample = await client.query(`
      SELECT video_id, video_title, category, sub_category, status, collection_type, view_count
      FROM unclassified_data
      WHERE day_key_local = '2025-10-10'
      ORDER BY view_count DESC
      LIMIT 5
    `);
    
    oct10Sample.rows.forEach(row => {
      console.log(`  - [${row.status}] ${row.video_title?.substring(0, 30)}... | ${row.category}>${row.sub_category} | ${row.collection_type} | 조회수: ${row.view_count}`);
    });

    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error('상세:', error);
  }
}

checkServerData();

