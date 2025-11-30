/**
 * 영상 AI 분석 API 핸들러
 * Gemini AI를 사용하여 유튜브 영상을 분석하고 결과를 저장/조회
 */

import path from 'path';
import { fileURLToPath } from 'url';

// 현재 파일의 디렉토리 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gemini 서비스 모듈을 동적으로 로드
 * 서버 환경에서 TypeScript 파일을 import하기 위한 헬퍼 함수
 */
async function loadGeminiService() {
  try {
    // 여러 경로 시도 (빌드 환경 및 개발 환경 모두 지원)
    // 배포 환경: /app/dist/server/src/server/api/analyze/video.js -> /app/dist/server/src/lib/gemini-service.js
    // 개발 환경: src/server/api/analyze/video.js -> src/lib/gemini-service.js
    // Node.js는 TypeScript를 직접 실행할 수 없으므로, tsx 또는 컴파일된 .js 파일이 필요합니다.
    const possiblePaths = [
      // 절대 경로 (배포 환경 우선)
      path.join(__dirname, '..', '..', '..', 'lib', 'gemini-service.js'),
      path.join(process.cwd(), 'dist', 'server', 'src', 'lib', 'gemini-service.js'),
      path.join(process.cwd(), 'src', 'lib', 'gemini-service.js'),
      // 상대 경로
      '../../../lib/gemini-service.js',
      // TypeScript 파일 시도 (tsx가 설치되어 있으면 작동)
      path.join(__dirname, '..', '..', '..', 'lib', 'gemini-service.ts'),
      path.join(process.cwd(), 'dist', 'server', 'src', 'lib', 'gemini-service.ts'),
      path.join(process.cwd(), 'src', 'lib', 'gemini-service.ts'),
      '../../../lib/gemini-service.ts'
    ];
    
    let lastError = null;
    for (const modulePath of possiblePaths) {
      try {
        console.log(`🔍 Gemini 서비스 모듈 로드 시도: ${modulePath}`);
        const geminiModule = await import(modulePath);
        if (geminiModule.analyzeVideoWithGemini) {
          console.log(`✅ Gemini 서비스 모듈 로드 성공: ${modulePath}`);
          return geminiModule.analyzeVideoWithGemini;
        } else {
          console.log(`⚠️ 모듈은 로드되었지만 analyzeVideoWithGemini 함수를 찾을 수 없습니다: ${modulePath}`);
        }
      } catch (pathError) {
        lastError = pathError;
        console.log(`⚠️ 모듈 로드 실패: ${modulePath} - ${pathError.message}`);
        // 다음 경로 시도
        continue;
      }
    }
    
    // 모든 경로 실패 시 상세한 오류 메시지
    const errorMessage = `모든 경로에서 gemini-service 모듈을 찾을 수 없습니다. 시도한 경로: ${possiblePaths.join(', ')}. 마지막 오류: ${lastError?.message || '알 수 없음'}`;
    console.error('❌ gemini-service 모듈 로드 실패:', errorMessage);
    throw new Error(errorMessage);
  } catch (error) {
    console.error('❌ gemini-service 모듈 로드 실패:', error);
    throw new Error(`Gemini 서비스 모듈을 로드할 수 없습니다: ${error.message}. @google/generative-ai 패키지가 설치되어 있는지 확인하세요.`);
  }
}

/**
 * [POST] /api/analyze/video
 * 영상 AI 분석 요청 처리
 * 
 * Request Body:
 * {
 *   videoId: string,
 *   title: string,
 *   channelName: string,
 *   description?: string,
 *   viewCount: number
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   source: 'cache' | 'api',
 *   data: {
 *     summary: string,
 *     viral_reason: string,
 *     keywords: string[],
 *     clickbait_score: number,
 *     sentiment: string
 *   }
 * }
 */
export async function handleAnalyzeVideo(req, res) {
  try {
    // 1. 요청 데이터 검증
    const { videoId, title, channelName, description, viewCount, apiKey } = req.body;

    if (!videoId || !title || !channelName || typeof viewCount !== 'number') {
      return res.status(400).json({
        success: false,
        error: '필수 필드가 누락되었습니다. (videoId, title, channelName, viewCount 필요)'
      });
    }

    // API 키 검증
    if (!apiKey || apiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'API 키가 필요합니다.'
      });
    }

    // 2. PostgreSQL pool 확인
    const pool = req.app.locals.pool;
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database connection not available',
        message: 'PostgreSQL pool이 초기화되지 않았습니다.'
      });
    }

    // 3. PostgreSQL 서비스 인스턴스 생성 (동적 로드)
    let createPostgreSQLService;
    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'lib', 'postgresql-service-server.js'),  // 최우선: 배포/개발 환경
      path.join(process.cwd(), 'src', 'lib', 'postgresql-service-server.js'),  // 절대 경로 (cwd 기준)
      path.join(process.cwd(), 'dist', 'server', 'src', 'lib', 'postgresql-service-server.js'),  // 배포 환경 절대 경로
      '../../../lib/postgresql-service-server.js'  // 상대 경로 폴백
    ];
    
    try {
      // 절대 경로를 사용하여 모듈 로드
      // 배포 환경: /app/dist/server/src/server/api/analyze/video.js -> /app/dist/server/src/lib/postgresql-service-server.js
      // 개발 환경: src/server/api/analyze/video.js -> src/lib/postgresql-service-server.js
      // 경로: __dirname -> .. -> .. -> .. -> lib -> postgresql-service-server.js
      
      let lastError = null;
      for (const modulePath of possiblePaths) {
        try {
          console.log(`🔍 PostgreSQL 서비스 모듈 로드 시도: ${modulePath}`);
          const postgresqlModule = await import(modulePath);
          if (postgresqlModule.createPostgreSQLService) {
            createPostgreSQLService = postgresqlModule.createPostgreSQLService;
            console.log(`✅ PostgreSQL 서비스 모듈 로드 성공: ${modulePath}`);
            break;
          }
        } catch (pathError) {
          lastError = pathError;
          console.log(`⚠️ 모듈 로드 실패: ${modulePath} - ${pathError.message}`);
          continue;
        }
      }
      
      if (!createPostgreSQLService) {
        throw new Error(`모듈을 찾을 수 없습니다. 시도한 경로: ${possiblePaths.join(', ')}. 마지막 오류: ${lastError?.message}`);
      }
    } catch (importError) {
      console.error('❌ PostgreSQL 서비스 모듈 로드 실패:', importError);
      console.error('❌ 시도한 경로들:', possiblePaths);
      console.error('❌ 현재 __dirname:', __dirname);
      console.error('❌ 현재 process.cwd():', process.cwd());
      return res.status(500).json({
        success: false,
        error: 'PostgreSQL 서비스 모듈을 로드할 수 없습니다.',
        message: importError.message
      });
    }
    
    const postgresqlService = createPostgreSQLService(pool);

    // 4. 기존 분석 결과 확인 (캐시 확인)
    console.log(`🔍 AI 분석 결과 캐시 확인: ${videoId}`);
    const cachedResult = await postgresqlService.getAiInsight(videoId);

    if (cachedResult) {
      console.log(`✅ 캐시된 분석 결과 반환: ${videoId}`);
      return res.status(200).json({
        success: true,
        source: 'cache',
        data: {
          summary: cachedResult.summary,
          viral_reason: cachedResult.viralReason,
          keywords: cachedResult.keywords || [],
          clickbait_score: cachedResult.clickbaitScore,
          sentiment: cachedResult.sentiment
        }
      });
    }

    // 5. 캐시가 없으면 Gemini AI로 분석
    console.log(`🤖 Gemini AI 분석 시작: ${videoId}`);
    
    // Gemini 서비스 동적 로드
    const analyzeVideoWithGemini = await loadGeminiService();
    
    const videoData = {
      videoId,
      title,
      channelName,
      viewCount,
      description: description || ''
    };

    const analysisResult = await analyzeVideoWithGemini(videoData, apiKey);

    // 6. 분석 결과를 DB에 저장
    console.log(`💾 AI 분석 결과 저장 중: ${videoId}`);
    await postgresqlService.saveAiInsight({
      videoId,
      summary: analysisResult.summary,
      viralReason: analysisResult.viral_reason,
      target_audience: analysisResult.target_audience,
      intro_hook: analysisResult.intro_hook,
      plot_structure: analysisResult.plot_structure,
      emotional_trigger: analysisResult.emotional_trigger,
      keywords: analysisResult.keywords,
      clickbaitScore: analysisResult.clickbait_score,
      sentiment: analysisResult.sentiment
    });

    // 7. 결과 반환
    console.log(`✅ AI 분석 완료 및 저장: ${videoId}`);
    return res.status(200).json({
      success: true,
      source: 'api',
      data: {
        summary: analysisResult.summary,
        viral_reason: analysisResult.viral_reason,
        keywords: analysisResult.keywords,
        clickbait_score: analysisResult.clickbait_score,
        sentiment: analysisResult.sentiment
      }
    });

  } catch (error) {
    console.error('❌ 영상 AI 분석 API 오류:', error);
    console.error('❌ 에러 스택:', error.stack);
    console.error('❌ 에러 타입:', error.constructor.name);
    console.error('❌ 요청 데이터:', {
      videoId: req.body?.videoId,
      title: req.body?.title?.substring(0, 50),
      channelName: req.body?.channelName,
      hasApiKey: !!req.body?.apiKey,
      apiKeyLength: req.body?.apiKey?.length || 0
    });
    
    // 에러 타입에 따라 적절한 상태 코드 반환
    if (error.message?.includes('API 키가 필요합니다') || error.message?.includes('API 키')) {
      return res.status(400).json({
        success: false,
        error: 'API 키가 필요하거나 유효하지 않습니다.',
        message: error.message,
        details: 'Gemini API 키를 확인해주세요.'
      });
    }

    if (error.message?.includes('모듈을 찾을 수 없습니다') || error.message?.includes('gemini-service') || error.message?.includes('postgresql-service')) {
      return res.status(500).json({
        success: false,
        error: '서비스 모듈을 로드할 수 없습니다.',
        message: error.message,
        details: error.message?.includes('postgresql-service') 
          ? 'PostgreSQL 서비스 모듈을 찾을 수 없습니다. 파일 경로를 확인하세요.'
          : '@google/generative-ai 패키지가 설치되어 있는지 확인하세요.'
      });
    }

    if (error.message?.includes('분석 실패') || error.message?.includes('영상 분석 실패')) {
      return res.status(500).json({
        success: false,
        error: 'AI 분석 중 오류가 발생했습니다.',
        message: error.message,
        details: 'Gemini API 호출이 실패했습니다. API 키와 네트워크 연결을 확인하세요.'
      });
    }

    return res.status(500).json({
      success: false,
      error: '영상 분석 처리 중 오류 발생',
      message: error.message || '알 수 없는 오류',
      details: error.stack || '서버 로그를 확인하세요.'
    });
  }
}

