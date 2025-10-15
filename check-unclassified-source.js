/**
 * unclassified_data에서 2025-10-15 데이터 출처 확인
 */

async function checkUnclassifiedSource() {
  try {
    console.log('🔍 2025-10-15 unclassified_data 조회 중...\n');
    
    const response = await fetch('https://api.youthbepulse.com/api/unclassified-by-date?date=2025-10-15');
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('데이터 조회 실패');
    }
    
    const data = result.data;
    console.log(`📅 2025-10-15 전체 데이터: ${data.length}개\n`);
    
    // 수집 타입별 분류
    console.log('📦 수집 타입별 분포:');
    const collectionTypes = {};
    data.forEach(item => {
      const type = item.collection_type || 'manual';
      collectionTypes[type] = (collectionTypes[type] || 0) + 1;
    });
    
    Object.entries(collectionTypes).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}개`);
    });
    
    console.log('');
    
    // 확인할 채널들
    const checkChannels = [
      'CoComelon - Cody Time',
      'Diana Belitskay', 
      'MaviGadget',
      'DisneyMusicVEVO',
      '깨비키즈'
    ];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔍 특정 영상 출처 분석:\n');
    
    for (const channelName of checkChannels) {
      const videos = data.filter(item => 
        item.channel_name && item.channel_name.includes(channelName)
      );
      
      if (videos.length > 0) {
        const video = videos[0];
        console.log(`📺 채널: ${video.channel_name}`);
        console.log(`   제목: ${video.video_title?.substring(0, 60)}...`);
        console.log(`   비디오ID: ${video.video_id}`);
        console.log(`   조회수: ${parseInt(video.view_count || 0).toLocaleString()}`);
        console.log(`   업로드: ${video.upload_date}`);
        console.log(`   수집일: ${video.collection_date || video.day_key_local}`);
        console.log(`   📌 수집타입: ${video.collection_type || 'manual'} ${video.collection_type === 'auto' ? '🤖' : '📝'}`);
        console.log(`   📌 키워드: ${video.keyword || video.searchKeyword || 'unknown'}`);
        console.log(`   📌 소스: ${video.source || video.collection_source || 'unknown'}`);
        console.log(`   분류: ${video.category || '미분류'} > ${video.sub_category || '미분류'}`);
        console.log('');
      } else {
        console.log(`❌ ${channelName}: 찾을 수 없음\n`);
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 한글 vs 해외
    const korean = data.filter(item => {
      const title = item.video_title || '';
      const channel = item.channel_name || '';
      return /[가-힣]/.test(title) || /[가-힣]/.test(channel);
    });
    
    const foreign = data.filter(item => {
      const title = item.video_title || '';
      const channel = item.channel_name || '';
      return !/[가-힣]/.test(title) && !/[가-힣]/.test(channel);
    });
    
    console.log('🌏 언어별 분포:');
    console.log(`   - 한글: ${korean.length}개 (${Math.round(korean.length / data.length * 100)}%)`);
    console.log(`   - 해외: ${foreign.length}개 (${Math.round(foreign.length / data.length * 100)}%)`);
    console.log('');
    
    // 해외 영상 상위 20개
    if (foreign.length > 0) {
      console.log('🌍 해외 영상 TOP 20 (조회수 순):\n');
      foreign
        .sort((a, b) => parseInt(b.view_count || 0) - parseInt(a.view_count || 0))
        .slice(0, 20)
        .forEach((item, i) => {
          console.log(`${i + 1}. ${item.channel_name}`);
          console.log(`   ${item.video_title?.substring(0, 50)}...`);
          console.log(`   조회수: ${parseInt(item.view_count || 0).toLocaleString()}, 키워드: ${item.keyword || item.searchKeyword || 'unknown'}`);
          console.log('');
        });
    }
    
    // 키워드별 분포 (자동수집인 경우)
    const autoCollected = data.filter(item => item.collection_type === 'auto');
    if (autoCollected.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`🤖 자동수집 데이터: ${autoCollected.length}개\n`);
      
      const keywords = {};
      autoCollected.forEach(item => {
        const keyword = item.keyword || item.searchKeyword || 'trending';
        keywords[keyword] = (keywords[keyword] || 0) + 1;
      });
      
      console.log('🔍 키워드별 분포:');
      Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .forEach(([keyword, count]) => {
          console.log(`   - ${keyword}: ${count}개`);
        });
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

checkUnclassifiedSource();

