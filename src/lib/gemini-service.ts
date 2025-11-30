/**
 * Google Gemini AI를 사용한 유튜브 영상 분석 서비스
 * 
 * @package @google/generative-ai
 * @model gemini-2.5-flash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * 영상 데이터 인터페이스
 */
export interface VideoDataForAnalysis {
  title: string;
  channelName: string;
  viewCount: number;
  description?: string;
}

/**
 * AI 분석 결과 인터페이스
 */
export interface VideoAnalysisResult {
  summary: string;
  viral_reason: string;
  keywords: string[];
  clickbait_score: number;
  sentiment: '긍정' | '부정' | '중립';
}

/**
 * Gemini AI를 사용하여 유튜브 영상을 분석합니다.
 * 
 * @param videoData - 분석할 영상 데이터
 * @param apiKey - Gemini API 키 (사용자 입력)
 * @returns AI 분석 결과 (JSON 형식)
 * @throws API 키가 없거나 분석 실패 시 에러 발생
 */
export async function analyzeVideoWithGemini(
  videoData: VideoDataForAnalysis,
  apiKey: string
): Promise<VideoAnalysisResult> {
  // API 키 검증
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API 키가 필요합니다.');
  }

  // Gemini AI 클라이언트 초기화
  const genAI = new GoogleGenerativeAI(apiKey);
  // 모델 이름: gemini-2.5-flash는 현재 가장 빠르고 유연한 모델입니다
  // generationConfig에 responseMimeType을 설정하여 JSON 응답을 직접 받을 수 있습니다
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { 
      responseMimeType: 'application/json'
    }
  });

  // 프롬프트 구성
  const prompt = `너는 유튜브 트렌드 분석 전문가야. 다음 영상 정보를 분석해서 시청자가 이 영상을 왜 보는지, 내용은 무엇인지 파악해줘.

제목: ${videoData.title}
채널: ${videoData.channelName}
조회수: ${videoData.viewCount}
설명: ${videoData.description || '(설명 없음)'}

응답은 오직 **JSON 형식**으로만 해줘:

{
  "summary": "3문장 요약",
  "viral_reason": "인기 요인 분석 (1문장)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "clickbait_score": 0~100 (낚시성 점수),
  "sentiment": "긍정/부정/중립"
}`;

  try {
    // Gemini API 호출
    // responseMimeType: "application/json"을 설정했으므로 응답이 직접 JSON 형식으로 옵니다
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON 파싱 (responseMimeType이 설정되어 있으므로 직접 파싱 가능)
    let analysisResult: VideoAnalysisResult;
    
    try {
      // responseMimeType: "application/json"을 사용하면 JSON이 직접 반환됩니다
      // 하지만 여전히 코드 블록이나 추가 텍스트가 포함될 수 있으므로 안전하게 처리
      const jsonText = text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      analysisResult = JSON.parse(jsonText);
    } catch (parseError) {
      // JSON 파싱 실패 시 텍스트에서 JSON 추출 시도
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`JSON 파싱 실패: ${text.substring(0, 200)}`);
      }
    }

    // 결과 검증 및 기본값 설정
    return {
      summary: analysisResult.summary || '분석 결과 없음',
      viral_reason: analysisResult.viral_reason || '인기 요인 분석 불가',
      keywords: Array.isArray(analysisResult.keywords) 
        ? analysisResult.keywords.slice(0, 5) 
        : [],
      clickbait_score: typeof analysisResult.clickbait_score === 'number'
        ? Math.max(0, Math.min(100, analysisResult.clickbait_score))
        : 50,
      sentiment: ['긍정', '부정', '중립'].includes(analysisResult.sentiment)
        ? analysisResult.sentiment as '긍정' | '부정' | '중립'
        : '중립'
    };
  } catch (error) {
    console.error('❌ Gemini AI 분석 실패:', error);
    throw new Error(`영상 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

