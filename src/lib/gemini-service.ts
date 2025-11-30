/**
 * Google Gemini AI를 사용한 유튜브 영상 분석 서비스
 * 
 * @package @google/generative-ai
 * @model gemini-2.5-flash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';

/**
 * 영상 데이터 인터페이스
 */
export interface VideoDataForAnalysis {
  videoId: string;
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
  target_audience?: string;
  intro_hook?: string;
  plot_structure?: string;
  emotional_trigger?: string;
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

  // 자막 추출 시도
  let transcriptText = '';
  try {
    console.log(`📝 자막 추출 시도: ${videoData.videoId}`);
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoData.videoId);
    
    if (transcriptItems && transcriptItems.length > 0) {
      // 자막을 공백으로 이어붙이기
      transcriptText = transcriptItems
        .map(item => item.text)
        .join(' ')
        .trim();
      
      // 토큰 제한 방지: 15,000자까지만 사용
      if (transcriptText.length > 15000) {
        transcriptText = transcriptText.substring(0, 15000);
        console.log(`⚠️ 자막이 너무 길어서 15,000자로 제한했습니다.`);
      }
      
      console.log(`✅ 자막 추출 성공: ${transcriptText.length}자`);
    } else {
      console.log(`⚠️ 자막이 없습니다. 설명(description)을 사용합니다.`);
    }
  } catch (transcriptError) {
    console.warn(`⚠️ 자막 추출 실패: ${transcriptError instanceof Error ? transcriptError.message : '알 수 없는 오류'}`);
    console.log(`📄 설명(description)을 대신 사용합니다.`);
  }

  // 자막이 없으면 설명(description) 사용
  const contentText = transcriptText || videoData.description || '(내용 없음)';

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

  // 프롬프트 구성 (범용 심층 분석)
  const prompt = `너는 '유튜브 콘텐츠 시나리오 분석 전문가'야.

아래 제공된 **영상 대본(Transcript)**과 메타데이터를 분석해서, 시청자를 끝까지 붙잡아둔 **'스토리텔링 구조'**와 **'성공 요인'**을 파헤쳐줘.

반드시 다음 JSON 형식으로만 답변해.

[영상 정보]

- 제목: ${videoData.title}

- 채널명: ${videoData.channelName}

- 대본(내용): ${contentText}

[분석 요구사항 (JSON)]

{
  "summary": "영상 내용을 기승전결이 명확하게 보이도록 3문장으로 요약",
  "viral_reason": "이 영상이 높은 조회수를 기록한 핵심 심리적/기술적 이유 (1문장)",
  "target_audience": "이 콘텐츠가 가장 소구되는 핵심 타겟층 (예: 2030 직장인, 5060 주부, 10대 게이머 등)",
  "intro_hook": "초반 60초 내에 시청자의 이탈을 막은 결정적인 **'오프닝 멘트'**나 **'상황 설정'** 분석",
  "plot_structure": "영상의 전개 구조 분석 (예: [도입]문제제기 -> [전개]실험/갈등 -> [절정]결과확인 -> [결말]인사이트/반전)",
  "emotional_trigger": "시청자가 느꼈을 핵심 감정 (예: 호기심, 공감, 분노, 대리만족, 정보충족 등)",
  "clickbait_score": 0~100 (제목/내용의 일치도 기반 낚시성 점수),
  "keywords": ["핵심키워드1", "핵심키워드2", "핵심키워드3", "핵심키워드4", "핵심키워드5"]
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
      target_audience: analysisResult.target_audience || '타겟층 분석 불가',
      intro_hook: analysisResult.intro_hook || '오프닝 분석 불가',
      plot_structure: analysisResult.plot_structure || '구조 분석 불가',
      emotional_trigger: analysisResult.emotional_trigger || '감정 분석 불가',
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

