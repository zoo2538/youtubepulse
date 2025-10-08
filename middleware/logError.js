/**
 * 에러 로깅 미들웨어
 * PostgreSQL 오류 및 요청 추적을 위한 상세 로깅
 */

const crypto = require('crypto');

/**
 * 요청 ID 생성
 * @returns {string} 고유한 요청 ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * PostgreSQL 오류 직렬화
 * @param {Error} error - PostgreSQL 오류 객체
 * @returns {Object} 직렬화된 오류 정보
 */
function serializePgError(error) {
  return {
    message: error.message,
    code: error.code,
    detail: error.detail,
    hint: error.hint,
    position: error.position,
    routine: error.routine,
    schema: error.schema,
    table: error.table,
    column: error.column,
    constraint: error.constraint,
    file: error.file,
    line: error.line,
    where: error.where,
    severity: error.severity,
    internalQuery: error.internalQuery,
    internalPosition: error.internalPosition,
    dataType: error.dataType,
    parameter: error.parameter
  };
}

/**
 * 일반 오류 직렬화
 * @param {Error} error - 오류 객체
 * @returns {Object} 직렬화된 오류 정보
 */
function serializeError(error) {
  const serialized = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    cause: error.cause
  };
  
  // PostgreSQL 오류인 경우 추가 정보 포함
  if (error.code) {
    serialized.pgError = serializePgError(error);
  }
  
  return serialized;
}

/**
 * 로그 레벨 정의
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * 구조화된 로그 출력
 * @param {string} level - 로그 레벨
 * @param {string} message - 로그 메시지
 * @param {Object} meta - 메타데이터
 */
function logStructured(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'youtube-pulse-api',
    ...meta
  };
  
  // 레벨별 이모지 및 색상
  const levelEmojis = {
    [LOG_LEVELS.ERROR]: '❌',
    [LOG_LEVELS.WARN]: '⚠️',
    [LOG_LEVELS.INFO]: 'ℹ️',
    [LOG_LEVELS.DEBUG]: '🔍'
  };
  
  const emoji = levelEmojis[level] || '📝';
  console.log(`${emoji} [${level.toUpperCase()}] ${message}`, JSON.stringify(logEntry, null, 2));
}

/**
 * 요청 로깅 미들웨어
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 */
function requestLogger(req, res, next) {
  const requestId = generateRequestId();
  req.requestId = requestId;
  
  // 요청 시작 로깅
  logStructured(LOG_LEVELS.INFO, 'Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  // 응답 완료 시 로깅
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logStructured(LOG_LEVELS.INFO, 'Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
}

/**
 * 오류 로깅 미들웨어
 * @param {Error} error - 오류 객체
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 */
function errorLogger(error, req, res, next) {
  const requestId = req.requestId || generateRequestId();
  
  // 오류 상세 로깅
  logStructured(LOG_LEVELS.ERROR, 'Request failed', {
    requestId,
    method: req.method,
    url: req.url,
    error: serializeError(error),
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  // PostgreSQL 연결 오류인 경우 특별 처리
  if (error.code && error.code.startsWith('08')) {
    logStructured(LOG_LEVELS.ERROR, 'PostgreSQL connection error detected', {
      requestId,
      error: serializePgError(error),
      suggestion: 'Check DATABASE_URL and connection pool settings'
    });
  }
  
  // YouTube API 오류인 경우 특별 처리
  if (error.message && error.message.includes('YouTube API')) {
    logStructured(LOG_LEVELS.WARN, 'YouTube API error detected', {
      requestId,
      error: serializeError(error),
      suggestion: 'Check API key and quota limits'
    });
  }
  
  next(error);
}

/**
 * 자동수집 전용 로거
 * @param {string} message - 로그 메시지
 * @param {Object} meta - 메타데이터
 */
function logAutoCollection(message, meta = {}) {
  logStructured(LOG_LEVELS.INFO, `[AutoCollection] ${message}`, {
    ...meta,
    component: 'auto-collector'
  });
}

/**
 * PostgreSQL 전용 로거
 * @param {string} message - 로그 메시지
 * @param {Object} meta - 메타데이터
 */
function logDatabase(message, meta = {}) {
  logStructured(LOG_LEVELS.INFO, `[Database] ${message}`, {
    ...meta,
    component: 'postgresql'
  });
}

module.exports = {
  generateRequestId,
  serializePgError,
  serializeError,
  logStructured,
  requestLogger,
  errorLogger,
  logAutoCollection,
  logDatabase,
  LOG_LEVELS
};
