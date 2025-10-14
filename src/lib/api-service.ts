// API 서버와 통신하는 서비스
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.youthbepulse.com';

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
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      // 타임아웃 설정 (60초로 증가)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

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
      console.error('API 요청 실패:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return { 
          success: false, 
          error: 'Request timeout (60s)' 
        };
      }
      
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
