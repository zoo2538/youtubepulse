// API 서버와 통신하는 서비스
import { API_BASE_URL } from './config';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // HTTP 요청 헬퍼
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    if (!this.baseURL) {
      console.warn('⚠️ API_BASE_URL이 설정되지 않아 서버 요청을 수행할 수 없습니다.');
      return {
        success: false,
        error: 'API base URL is not configured.'
      };
    }
    
    const url = `${this.baseURL}${endpoint}`;
    
    // 네트워크 상태 확인
    if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
      console.warn('⚠️ 오프라인 상태 - 네트워크 연결을 확인하세요');
      return {
        success: false,
        error: 'Network is offline. Please check your internet connection.'
      };
    }
    
    // 사용자 정의 signal이 있으면 사용, 없으면 타임아웃용 signal 생성
    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let signal: AbortSignal | undefined = options.signal;
    
    // 사용자 정의 signal이 없으면 타임아웃용 signal 생성
    if (!signal) {
      controller = new AbortController();
      signal = controller.signal;
      timeoutId = setTimeout(() => {
        if (controller) {
          console.warn('⏱️ 요청 타임아웃 (120초) - 서버 응답이 지연되고 있습니다');
          controller.abort();
        }
      }, 120000); // 120초 타임아웃
    }
    
    try {
      // options에서 signal 제거 (이미 위에서 설정)
      const { signal: _, ...restOptions } = options;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...restOptions.headers,
        },
        signal,
        ...restOptions,
      });

      // 타임아웃 정리
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        // 서버 에러 상세 정보 수집
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData, null, 2);
        } catch {
          errorDetails = `Status: ${response.status}, StatusText: ${response.statusText}`;
        }
        
        console.error('🚨 서버 에러 상세:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          details: errorDetails,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        throw new Error(`HTTP error! status: ${response.status} - ${errorDetails}`);
      }

      const data = await response.json();
      
      // 서버가 이미 { success, data } 형식으로 반환하는 경우 그대로 반환
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        console.log('📦 서버 응답이 이미 표준 형식:', { success: data.success, dataLength: data.data?.length });
        return data;
      }
      
      // 그렇지 않으면 래핑
      return { success: true, data };
    } catch (error) {
      // 타임아웃 정리 (에러 발생 시에도)
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // AbortError 상세 로깅
      if (error instanceof Error && error.name === 'AbortError') {
        const isTimeout = controller?.signal.aborted && !options.signal?.aborted;
        const errorMessage = isTimeout 
          ? 'Request timeout (120s)' 
          : 'Request aborted';
        
        console.error('🚨 API 요청 중단:', {
          url,
          error: errorMessage,
          reason: error.message || 'No reason provided',
          wasTimeout: isTimeout,
          hasCustomSignal: !!options.signal
        });
        
        return { 
          success: false, 
          error: errorMessage 
        };
      }
      
      // 네트워크 오류 상세 로깅
      console.error('🚨 API 요청 실패:', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // 채널 데이터 저장
  async saveChannels(channels: Record<string, any>): Promise<ApiResponse<any>> {
    return this.request('/api/channels', {
      method: 'POST',
      body: JSON.stringify({ channels }),
    });
  }

  // 채널 데이터 조회
  async getChannels(): Promise<ApiResponse<any>> {
    return this.request('/api/channels');
  }

  // 비디오 데이터 저장
  async saveVideos(videos: Record<string, any>): Promise<ApiResponse<any>> {
    return this.request('/api/videos', {
      method: 'POST',
      body: JSON.stringify({ videos }),
    });
  }

  // 비디오 데이터 조회
  async getVideos(): Promise<ApiResponse<any>> {
    return this.request('/api/videos');
  }

  // 분류 데이터 저장
  async saveClassifiedData(data: any): Promise<ApiResponse<any>> {
    return this.request('/api/classified', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 분류 데이터 조회
  async getClassifiedData(): Promise<ApiResponse<any>> {
    return this.request('/api/classified');
  }

  // 미분류 데이터 저장
  async saveUnclassifiedData(data: any): Promise<ApiResponse<any>> {
    return this.request('/api/unclassified', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 미분류 데이터 조회
  async getUnclassifiedData(): Promise<ApiResponse<any>> {
    return this.request('/api/unclassified');
  }

  // 서버 데이터 ID 목록 조회 (차분 업로드용)
  async getDataIds(): Promise<ApiResponse<{ unclassifiedIds: string[]; classifiedIds: string[] }>> {
    return this.request('/api/data/ids');
  }

  // 시스템 설정 저장
  async saveSystemConfig(key: string, value: any): Promise<ApiResponse<any>> {
    return this.request('/api/system/config', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  }

  // 시스템 설정 조회
  async getSystemConfig(key: string): Promise<ApiResponse<any>> {
    return this.request(`/api/system/config/${key}`);
  }

  // 일별 통계 저장
  async saveDailyStats(date: string, stats: any): Promise<ApiResponse<any>> {
    return this.request('/api/daily-stats', {
      method: 'POST',
      body: JSON.stringify({ date, stats }),
    });
  }

  // 일별 통계 조회
  async getDailyStats(date?: string): Promise<ApiResponse<any>> {
    const endpoint = date ? `/api/daily-stats/${date}` : '/api/daily-stats';
    return this.request(endpoint);
  }

  // API 서버 연결 테스트
  async testConnection(): Promise<ApiResponse<any>> {
    return this.request('/api/health');
  }

  // 개별 비디오 수정
  async updateVideo(id: string, updateData: any): Promise<ApiResponse<any>> {
    return this.request(`/api/videos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  // 개별 비디오 삭제
  async deleteVideo(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/videos/${id}`, {
      method: 'DELETE',
    });
  }

  // 배치 비디오 삭제
  async deleteVideosBatch(ids: string[]): Promise<ApiResponse<any>> {
    return this.request('/api/videos/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
