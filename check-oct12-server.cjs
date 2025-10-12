const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:EIPQAobslIttLZIJFiMCKOMuMwdMRncp@junction.proxy.rlwy.net:47737/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkOct12Data() {
  const client = await pool.connect();
  try {
    console.log('\n=== 10월 12일 서버 데이터 확인 ===\n');
    
    // 1. 전체 데이터 수
    const totalResult = await client.query(`
      SELECT COUNT(*) as count
      FROM unclassified_data
      WHERE day_key_local = '2025-10-12'
    `);
    console.log(`📊 전체 데이터: ${totalResult.rows[0].count}개`);
    
    // 2. collection_type별 분포
    const typeResult = await client.query(`
      SELECT collection_type, COUNT(*) as count
      FROM unclassified_data
      WHERE day_key_local = '2025-10-12'
      GROUP BY collection_type
      ORDER BY collection_type
    `);
    console.log('\n📈 수집 타입별 분포:');
    typeResult.rows.forEach(row => {
      console.log(`  - ${row.collection_type || 'NULL'}: ${row.count}개`);
    });
    
    // 3. 키워드별 분포 (수동수집)
    const keywordResult = await client.query(`
      SELECT keyword, COUNT(*) as count
      FROM unclassified_data
      WHERE day_key_local = '2025-10-12'
        AND collection_type = 'manual'
      GROUP BY keyword
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('\n🔍 수동수집 키워드 TOP 10:');
    keywordResult.rows.forEach(row => {
      console.log(`  - ${row.keyword || '(트렌드)'}: ${row.count}개`);
    });
    
    // 4. 샘플 데이터 5개
    const sampleResult = await client.query(`
      SELECT video_id, title, collection_type, keyword, view_count
      FROM unclassified_data
      WHERE day_key_local = '2025-10-12'
        AND collection_type = 'manual'
      ORDER BY view_count DESC
      LIMIT 5
    `);
    console.log('\n📺 수동수집 샘플 데이터 (조회수 높은 순 5개):');
    sampleResult.rows.forEach((row, idx) => {
      console.log(`\n  ${idx + 1}. ${row.title.substring(0, 50)}...`);
      console.log(`     비디오ID: ${row.video_id}`);
      console.log(`     조회수: ${row.view_count?.toLocaleString()}`);
      console.log(`     키워드: ${row.keyword || '(트렌드)'}`);
    });
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkOct12Data();

