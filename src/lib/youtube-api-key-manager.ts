/**
 * YouTube API 키 관리 및 로테이션 서비스
 * 할당량 추적 및 자동 키 전환 기능 포함
 */

interface ApiKeyUsage {
  key: string;
  dailyQuota: number; // 일일 할당량 (기본 10,000)
  usedQuota: number; // 사용된 할당량
  lastUsed: string; // 마지막 사용 시간
  isExhausted: boolean; // 할당량 소진 여부
}

interface ApiKeyStatus {
  index: number;
  key: string;
  usedQuota: number;
  remainingQuota: number;
  dailyQuota: number;
  usagePercent: number;
  isActive: boolean;
  isExhausted: boolean;
  lastUsed: string;
}

const STORAGE_KEY = 'youtubeApiKeyUsage';
const DEFAULT_DAILY_QUOTA = 10000; // YouTube API 기본 일일 할당량
const QUOTA_THRESHOLD = 0.95; // 95% 사용 시 경고

/**
 * API 키 사용량 저장
 */
function saveApiKeyUsage(usage: Record<number, ApiKeyUsage>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch (error) {
    console.error('API 키 사용량 저장 실패:', error);
  }
}

/**
 * API 키 사용량 불러오기
 */
function loadApiKeyUsage(): Record<number, ApiKeyUsage> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('API 키 사용량 불러오기 실패:', error);
  }
  return {};
}

/**
 * 오늘 날짜 키 생성 (할당량은 일일 기준)
 */
function getTodayKey(): string {
  const today = new Date().toISOString().split('T')[0];
  return `quota_${today}`;
}

/**
 * API 키 사용량 초기화 (날짜 변경 시)
 */
function resetDailyQuotaIfNeeded(usage: Record<number, ApiKeyUsage>): Record<number, ApiKeyUsage> {
  const today = getTodayKey();
  const lastReset = localStorage.getItem('lastQuotaReset');
  
  if (lastReset !== today) {
    // 날짜가 변경되었으므로 모든 키의 사용량 초기화
    Object.keys(usage).forEach(index => {
      const idx = parseInt(index);
      if (usage[idx]) {
        usage[idx].usedQuota = 0;
        usage[idx].isExhausted = false;
        usage[idx].lastUsed = new Date().toISOString();
      }
    });
    localStorage.setItem('lastQuotaReset', today);
    saveApiKeyUsage(usage);
  }
  
  return usage;
}

/**
 * API 키 사용량 업데이트
 */
export function recordApiKeyUsage(index: number, quotaUsed: number): void {
  const usage = loadApiKeyUsage();
  const resetUsage = resetDailyQuotaIfNeeded(usage);
  
  if (!resetUsage[index]) {
    resetUsage[index] = {
      key: '',
      dailyQuota: DEFAULT_DAILY_QUOTA,
      usedQuota: 0,
      lastUsed: new Date().toISOString(),
      isExhausted: false
    };
  }
  
  resetUsage[index].usedQuota += quotaUsed;
  resetUsage[index].lastUsed = new Date().toISOString();
  
  // 할당량 소진 확인
  if (resetUsage[index].usedQuota >= resetUsage[index].dailyQuota) {
    resetUsage[index].isExhausted = true;
    console.warn(`⚠️ API 키 #${index + 1} 할당량 소진: ${resetUsage[index].usedQuota}/${resetUsage[index].dailyQuota}`);
  }
  
  saveApiKeyUsage(resetUsage);
}

/**
 * 사용 가능한 API 키 찾기
 */
export function getAvailableApiKey(): { index: number; key: string } | null {
  const savedApiKeysRaw = localStorage.getItem('youtubeApiKeys');
  if (!savedApiKeysRaw) {
    return null;
  }
  
  let savedApiKeys: string[] = [];
  try {
    const parsed = JSON.parse(savedApiKeysRaw);
    if (Array.isArray(parsed)) {
      savedApiKeys = parsed.filter(key => typeof key === 'string' && key.trim().length > 0);
    }
  } catch (error) {
    console.error('API 키 목록 파싱 실패:', error);
    return null;
  }
  
  if (savedApiKeys.length === 0) {
    return null;
  }
  
  const usage = resetDailyQuotaIfNeeded(loadApiKeyUsage());
  const savedActiveIndexRaw = localStorage.getItem('activeYoutubeApiKeyIndex');
  let currentIndex = savedActiveIndexRaw ? parseInt(savedActiveIndexRaw, 10) : 0;
  
  // 현재 키부터 시작하여 사용 가능한 키 찾기
  for (let i = 0; i < savedApiKeys.length; i++) {
    const checkIndex = (currentIndex + i) % savedApiKeys.length;
    const key = savedApiKeys[checkIndex];
    
    if (!key || key.trim().length === 0) {
      continue;
    }
    
    // 사용량 확인
    const keyUsage = usage[checkIndex];
    if (!keyUsage || !keyUsage.isExhausted) {
      // 사용 가능한 키 발견
      if (checkIndex !== currentIndex) {
        // 다른 키로 전환
        localStorage.setItem('activeYoutubeApiKeyIndex', checkIndex.toString());
        console.log(`🔄 API 키 전환: #${currentIndex + 1} → #${checkIndex + 1}`);
      }
      return { index: checkIndex, key };
    }
  }
  
  // 모든 키가 소진된 경우
  console.error('❌ 모든 API 키의 할당량이 소진되었습니다.');
  return null;
}

/**
 * 현재 활성 API 키 가져오기
 */
export function getCurrentApiKey(): string | null {
  const result = getAvailableApiKey();
  return result ? result.key : null;
}

/**
 * API 키 상태 조회
 */
export function getApiKeyStatuses(): ApiKeyStatus[] {
  const savedApiKeysRaw = localStorage.getItem('youtubeApiKeys');
  if (!savedApiKeysRaw) {
    return [];
  }
  
  let savedApiKeys: string[] = [];
  try {
    const parsed = JSON.parse(savedApiKeysRaw);
    if (Array.isArray(parsed)) {
      savedApiKeys = parsed.filter(key => typeof key === 'string');
    }
  } catch (error) {
    return [];
  }
  
  const usage = resetDailyQuotaIfNeeded(loadApiKeyUsage());
  const savedActiveIndexRaw = localStorage.getItem('activeYoutubeApiKeyIndex');
  const activeIndex = savedActiveIndexRaw ? parseInt(savedActiveIndexRaw, 10) : 0;
  
  return savedApiKeys.map((key, index) => {
    const keyUsage = usage[index] || {
      dailyQuota: DEFAULT_DAILY_QUOTA,
      usedQuota: 0,
      lastUsed: '',
      isExhausted: false
    };
    
    const remainingQuota = Math.max(0, keyUsage.dailyQuota - keyUsage.usedQuota);
    const usagePercent = (keyUsage.usedQuota / keyUsage.dailyQuota) * 100;
    
    return {
      index,
      key: key ? `${key.substring(0, 10)}...` : '미설정',
      usedQuota: keyUsage.usedQuota,
      remainingQuota,
      dailyQuota: keyUsage.dailyQuota,
      usagePercent: Math.min(100, usagePercent),
      isActive: index === activeIndex,
      isExhausted: keyUsage.isExhausted || !key || key.trim().length === 0,
      lastUsed: keyUsage.lastUsed || '사용 안 함'
    };
  });
}

/**
 * API 키 사용량 초기화 (수동)
 */
export function resetApiKeyUsage(index?: number): void {
  const usage = loadApiKeyUsage();
  
  if (index !== undefined) {
    // 특정 키만 초기화
    if (usage[index]) {
      usage[index].usedQuota = 0;
      usage[index].isExhausted = false;
      usage[index].lastUsed = new Date().toISOString();
    }
  } else {
    // 모든 키 초기화
    Object.keys(usage).forEach(idx => {
      const i = parseInt(idx);
      if (usage[i]) {
        usage[i].usedQuota = 0;
        usage[i].isExhausted = false;
        usage[i].lastUsed = new Date().toISOString();
      }
    });
  }
  
  saveApiKeyUsage(usage);
  localStorage.setItem('lastQuotaReset', getTodayKey());
}

/**
 * API 키 할당량 설정 (기본값 변경)
 */
export function setApiKeyQuota(index: number, quota: number): void {
  const usage = loadApiKeyUsage();
  
  if (!usage[index]) {
    usage[index] = {
      key: '',
      dailyQuota: quota,
      usedQuota: 0,
      lastUsed: new Date().toISOString(),
      isExhausted: false
    };
  } else {
    usage[index].dailyQuota = quota;
  }
  
  saveApiKeyUsage(usage);
}

