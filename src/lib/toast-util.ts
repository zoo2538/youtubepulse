// 간단한 토스트 알림 유틸
export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  type?: ToastType;
  duration?: number; // ms
}

export function showToast(message: string, options: ToastOptions = {}) {
  const { type = 'info', duration = 3000 } = options;

  // 기존 토스트 제거
  const existingToast = document.getElementById('app-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 토스트 요소 생성
  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.textContent = message;

  // 스타일 적용
  const typeStyles = {
    info: 'background: #3b82f6; color: white;',
    success: 'background: #10b981; color: white;',
    warning: 'background: #f59e0b; color: white;',
    error: 'background: #ef4444; color: white;'
  };

  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    ${typeStyles[type]}
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;

  // 애니메이션 CSS 추가
  if (!document.getElementById('toast-animation-style')) {
    const style = document.createElement('style');
    style.id = 'toast-animation-style';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // 자동 제거
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

