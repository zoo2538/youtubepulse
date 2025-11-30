/**
 * 영상 AI 분석 API 핸들러
 * Gemini AI를 사용하여 유튜브 영상을 분석하고 결과를 저장/조회
 */

import { createPostgreSQLService } from '../../../lib/postgresql-service-server.js';

/**
 * Gemini 서비스 모듈을 동적으로 로드
 * 서버 환경에서 TypeScript 파일을 import하기 위한 헬퍼 함수
 */
async function loadGeminiService() {
  try {
    // 여러 경로 시도 (빌드 환경 및 개발 환경 모두 지원)
    // 배포 환경: dist/server/src/server/api/analyze/video.js -> dist/server/src/lib/gemini-service.js
    // 개발 환경: src/server/api/analyze/video.js -> src/lib/gemini-service.js
    const possiblePaths = [
      '../../../lib/gemini-service.js',  // 최우선: 배포 환경 (dist/server/src/server/api/analyze -> dist/server/src/lib)
      '../../../lib/gemini-service.ts',  // 최우선: 개발 환경 (src/server/api/analyze -> src/lib)
      '../../lib/gemini-service.js',  // 폴백: 빌드된 파일
      '../../lib/gemini-service.ts',  // 폴백: 소스 파일 (개발)
      '../../../../lib/gemini-service.js',  // 추가 폴백
      '../../../../lib/gemini-service.ts'   // 추가 폴백
    ];
    
    for (const modulePath of possiblePaths) {
      try {
        const geminiModule = await import(modulePath);
        if (geminiModule.analyzeVideoWithGemini) {
          return geminiModule.analyzeVideoWithGemini;
        }
      } catch (pathError) {
        // 다음 경로 시도
        continue;
      }
    }
    
    throw new Error('모든 경로에서 gemini-service 모듈을 찾을 수 없습니다.');
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

    // 3. PostgreSQL 서비스 인스턴스 생성
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

    if (error.message?.includes('모듈을 찾을 수 없습니다') || error.message?.includes('gemini-service')) {
      return res.status(500).json({
        success: false,
        error: 'Gemini 서비스 모듈을 로드할 수 없습니다.',
        message: error.message,
        details: '@google/generative-ai 패키지가 설치되어 있는지 확인하세요.'
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

