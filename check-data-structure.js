/**
 * 데이터 구조 확인
 */

async function checkDataStructure() {
  try {
    const response = await fetch('https://api.youthbepulse.com/api/unclassified-by-date?date=2025-10-15');
    const result = await response.json();
    
    if (!result.success || !result.data || result.data.length === 0) {
      console.log('데이터 없음');
      return;
    }
    
    const data = result.data;
    console.log(`📅 총 ${data.length}개 데이터\n`);
    
    // 첫 번째 데이터의 구조 확인
    console.log('📋 첫 번째 데이터 구조:\n');
    const first = data[0];
    console.log(JSON.stringify(first, null, 2));
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 필드명 확인
    console.log('🔑 사용 가능한 필드명:');
    Object.keys(first).forEach(key => {
      const value = first[key];
      const type = typeof value;
      const preview = type === 'string' && value 
        ? value.substring(0, 30) + (value.length > 30 ? '...' : '')
        : value;
      console.log(`   - ${key} (${type}): ${preview}`);
    });
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

checkDataStructure();

