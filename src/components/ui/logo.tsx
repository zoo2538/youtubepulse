import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true, 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* 그라데이션 하트 로고 */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="w-full h-full bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 rounded-xl flex items-center justify-center relative overflow-hidden">
          {/* 하트 모양 */}
          <div className="relative w-6 h-6 transform rotate-45">
            {/* 왼쪽 하트 */}
            <div className="absolute -left-1 -top-1 w-3 h-3 bg-white rounded-full opacity-30"></div>
            {/* 오른쪽 하트 */}
            <div className="absolute -right-1 -top-1 w-3 h-3 bg-white rounded-full opacity-30"></div>
            {/* 하트 하단 */}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full opacity-20"></div>
          </div>
          
          {/* 하이라이트 효과 */}
          <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full opacity-40"></div>
        </div>
      </div>

      {/* 텍스트 */}
      {showText && (
        <div>
          <h1 className={`font-bold bg-gradient-to-r from-white via-pink-300 to-red-600 bg-clip-text text-transparent ${textSizeClasses[size]}`}>
            YouTube Pulse
          </h1>
          {size === 'lg' && (
            <p className="text-gray-300 text-sm">실시간 유튜브 트렌드 분석 플랫폼</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;



