// 현재 환경이 Node.js인지 확인
const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.cwd === 'function';

// Node.js 환경일 때 API 키를 저장할 파일 경로 (조건부로만 계산)
const getNodeStoragePath = (): string | null => {
  if (!isNode) return null;
  try {
    // 동적 require로 Node.js 모듈 로드 (브라우저 번들에서 제외)
    const path = require('path');
    if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      return path.join(process.cwd(), 'data', 'api-key-usage.json');
    }
    return null;
  } catch {
    return null;
  }
};

// Node.js용: 파일 읽기 (저장된 키 사용량을 가져옴)
const getFileStorage = (): Record<string, string> => {
  if (!isNode) return {};
  
  try {
    const fs = require('fs');
    const storagePath = getNodeStoragePath();
    if (!storagePath || !fs.existsSync(storagePath)) {
      return {};
    }
    // 파일이 있으면 읽어서 JSON 파싱
    return JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
  } catch {
    return {};
  }
};

// Node.js용: 파일 쓰기 (변경된 키 사용량을 저장)
const setFileStorage = (data: Record<string, string>): void => {
  if (!isNode) return;
  
  try {
    const fs = require('fs');
    const path = require('path');
    const storagePath = getNodeStoragePath();
    if (!storagePath) return;
    
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // JSON.stringify로 데이터를 파일에 저장
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
  } catch {
    // 파일 저장 실패 시 무시 (브라우저 환경에서는 발생하지 않음)
  }
};

// 환경에 따라 LocalStorage와 파일 시스템을 자동으로 분기하는 만능 저장소
export const universalStorage = {
  getItem: (key: string): string | null => {
    if (isNode) {
      return getFileStorage()[key] || null;
    }
    // 브라우저 환경에서는 기존 LocalStorage 사용
    return localStorage.getItem(key);
  },
  
  setItem: (key: string, value: string): void => {
    if (isNode) {
      const data = getFileStorage();
      data[key] = value;
      setFileStorage(data);
    } else {
      // 브라우저 환경에서는 기존 LocalStorage 사용
      localStorage.setItem(key, value);
    }
  },
  
  removeItem: (key: string): void => {
    if (isNode) {
      const data = getFileStorage();
      delete data[key];
      setFileStorage(data);
    } else {
      localStorage.removeItem(key);
    }
  }
};

