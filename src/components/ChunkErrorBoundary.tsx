import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ChunkErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ChunkErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ChunkErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    // 동적 import 실패 감지
    if (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('Loading CSS chunk')) {
      return { hasError: true, error };
    }
    return { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 청크 로딩 오류 감지:', error);
    console.error('📍 오류 정보:', errorInfo);
    
    // 동적 import 실패인 경우에만 처리
    if (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('Loading CSS chunk')) {
      this.setState({ hasError: true, error });
    }
  }

  handleRefresh = () => {
    // 강력 새로고침으로 캐시 무효화
    window.location.reload();
  };

  handleHardRefresh = () => {
    // 시크릿 모드와 같은 효과 (캐시 완전 무효화)
    window.location.href = window.location.href + '?v=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full mx-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="mt-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-orange-800">앱 업데이트 감지</h3>
                    <p className="text-sm text-orange-700 mt-1">
                      새로운 버전이 배포되었습니다. 페이지를 새로고침하여 최신 버전을 사용하세요.
                    </p>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <Button 
                      onClick={this.handleRefresh}
                      className="w-full"
                      variant="default"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      새로고침
                    </Button>
                    
                    <Button 
                      onClick={this.handleHardRefresh}
                      variant="outline"
                      className="w-full"
                    >
                      강력 새로고침 (캐시 무효화)
                    </Button>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>💡 <strong>문제가 지속되면:</strong></p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>브라우저 캐시를 수동으로 삭제하세요</li>
                      <li>시크릿/프라이빗 모드로 시도해보세요</li>
                      <li>다른 브라우저로 접속해보세요</li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChunkErrorBoundary;
