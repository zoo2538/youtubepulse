/**
 * 올바른 필드명으로 비디오 출처 확인
 */

async function checkVideoSource() {
  try {
    console.log('🔍 2025-10-15 데이터 조회 중...\n');
    
    const response = await fetch('https://api.youthbepulse.com/api/unclassified-by-date?date=2025-10-15');
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('데이터 조회 실패');
    }
    
    const data = result.data;
    console.log(`📅 2025-10-15 전체 데이터: ${data.length}개\n`);
    
    // 수집 타입
    console.log('📦 수집 타입:');
    const types = {};
    data.forEach(item => {
      const type = item.collectionType || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });
    Object.entries(types).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}개`);
    });
    console.log('');
    
    // 생성 시간
    console.log('⏰ 생성 시간:');
    const createTimes = {};
    data.forEach(item => {
      if (item.createdAt) {
        const time = new Date(item.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const hour = time.split(' ')[1].split(':')[0];
        createTimes[hour] = (createTimes[hour] || 0) + 1;
      }
    });
    Object.entries(createTimes)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([hour, count]) => {
        console.log(`   - ${hour}시: ${count}개`);
      });
    console.log('');
    
    // 확인할 채널
    const checkChannels = [
      'CoComelon',
      'Diana Belitskay',
      'MaviGadget',
      'DisneyMusic',
      '깨비키즈'
    ];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔍 특정 채널 영상 출처:\n');
    
    for (const channelName of checkChannels) {
      const videos = data.filter(item => 
        item.channelName && item.channelName.includes(channelName)
      );
      
      if (videos.length > 0) {
        const video = videos[0];
        console.log(`📺 채널: ${video.channelName}`);
        console.log(`   제목: ${video.videoTitle?.substring(0, 60)}...`);
        console.log(`   조회수: ${parseInt(video.viewCount || 0).toLocaleString()}`);
        console.log(`   업로드: ${video.uploadDate}`);
        console.log(`   수집일: ${video.collectionDate}`);
        console.log(`   생성시간: ${new Date(video.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        console.log(`   📌 수집타입: ${video.collectionType || 'unknown'} ${video.collectionType === 'auto' ? '🤖' : '📝'}`);
        console.log(`   📌 키워드: ${video.keyword || 'unknown'}`);
        console.log(`   분류: ${video.category || '미분류'} > ${video.subCategory || '미분류'}`);
        console.log('');
      } else {
        console.log(`❌ ${channelName}: 찾을 수 없음\n`);
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 한글 vs 해외
    const korean = data.filter(item => {
      const title = item.videoTitle || '';
      const channel = item.channelName || '';
      return /[가-힣]/.test(title) || /[가-힣]/.test(channel);
    });
    
    const foreign = data.filter(item => {
      const title = item.videoTitle || '';
      const channel = item.channelName || '';
      return !/[가-힣]/.test(title) && !/[가-힣]/.test(channel);
    });
    
    console.log('🌏 언어별 분포:');
    console.log(`   - 한글: ${korean.length}개 (${Math.round(korean.length / data.length * 100)}%)`);
    console.log(`   - 해외: ${foreign.length}개 (${Math.round(foreign.length / data.length * 100)}%)`);
    console.log('');
    
    // 해외 영상 상위 10개
    if (foreign.length > 0) {
      console.log('🌍 해외 영상 TOP 10 (조회수 순):\n');
      foreign
        .sort((a, b) => parseInt(b.viewCount || 0) - parseInt(a.viewCount || 0))
        .slice(0, 10)
        .forEach((item, i) => {
          console.log(`${i + 1}. ${item.channelName}`);
          console.log(`   ${item.videoTitle?.substring(0, 50)}...`);
          console.log(`   조회수: ${parseInt(item.viewCount || 0).toLocaleString()}`);
          console.log(`   수집타입: ${item.collectionType || 'unknown'}`);
          console.log('');
        });
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

checkVideoSource();

