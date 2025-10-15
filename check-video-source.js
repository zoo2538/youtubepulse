/**
 * 특정 비디오의 출처 확인 스크립트
 */

async function checkVideoSource() {
  try {
    console.log('🔍 2025-10-15 자동수집 데이터 조회 중...\n');
    
    const response = await fetch('https://api.youthbepulse.com/api/auto-collected');
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('데이터 조회 실패');
    }
    
    // 2025-10-15 데이터만 필터링
    const data = result.data.filter(item => {
      const date = item.day_key_local || item.collection_date || '';
      return date.includes('2025-10-15');
    });
    
    console.log(`📅 2025-10-15 데이터: ${data.length}개\n`);
    
    // 확인할 비디오들
    const checkVideos = [
      'CoComelon - Cody Time',
      'Diana Belitskay',
      'MaviGadget',
      'DisneyMusicVEVO',
      '깨비키즈'
    ];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    for (const channelName of checkVideos) {
      const video = data.find(item => 
        item.channel_name && item.channel_name.includes(channelName)
      );
      
      if (video) {
        console.log(`📺 채널: ${video.channel_name}`);
        console.log(`   비디오: ${video.video_title?.substring(0, 50)}...`);
        console.log(`   조회수: ${parseInt(video.view_count || 0).toLocaleString()}`);
        console.log(`   업로드: ${video.upload_date}`);
        console.log(`   수집일: ${video.collection_date || video.day_key_local}`);
        console.log(`   수집타입: ${video.collection_type || 'unknown'}`);
        console.log(`   키워드: ${video.keyword || video.searchKeyword || 'unknown'}`);
        console.log(`   소스: ${video.source || 'unknown'}`);
        console.log(`   분류: ${video.category || '미분류'} > ${video.sub_category || '미분류'}`);
        console.log('');
      } else {
        console.log(`❌ ${channelName} 영상을 찾을 수 없음\n`);
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 전체 통계
    console.log('📊 전체 통계:\n');
    
    // 키워드별 분포
    const keywordDist = {};
    data.forEach(item => {
      const keyword = item.keyword || item.searchKeyword || 'unknown';
      keywordDist[keyword] = (keywordDist[keyword] || 0) + 1;
    });
    
    console.log('🔍 키워드별 분포:');
    Object.entries(keywordDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([keyword, count]) => {
        console.log(`   - ${keyword}: ${count}개`);
      });
    
    console.log('');
    
    // 한글/해외 비율
    const korean = data.filter(item => {
      const title = item.video_title || '';
      const channel = item.channel_name || '';
      return /[가-힣]/.test(title) || /[가-힣]/.test(channel);
    });
    
    const foreign = data.length - korean.length;
    
    console.log('🌏 언어 분포:');
    console.log(`   - 한글 영상: ${korean.length}개 (${Math.round(korean.length / data.length * 100)}%)`);
    console.log(`   - 해외 영상: ${foreign}개 (${Math.round(foreign / data.length * 100)}%)`);
    
    console.log('');
    
    // 해외 영상 TOP 10
    if (foreign > 0) {
      console.log('🌍 해외 영상 TOP 10:');
      data.filter(item => {
        const title = item.video_title || '';
        const channel = item.channel_name || '';
        return !/[가-힣]/.test(title) && !/[가-힣]/.test(channel);
      })
      .sort((a, b) => parseInt(b.view_count || 0) - parseInt(a.view_count || 0))
      .slice(0, 10)
      .forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.channel_name} - ${item.video_title?.substring(0, 40)}...`);
        console.log(`      조회수: ${parseInt(item.view_count || 0).toLocaleString()}, 키워드: ${item.keyword || item.searchKeyword || 'unknown'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

checkVideoSource();

