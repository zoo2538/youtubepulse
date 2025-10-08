/**
 * 지수 백오프 재시도 유틸리티
 * 자동수집 저장 실패 시 재시도 로직
 */

/**
 * 지수 백오프로 재시도 실행
 * @param {Function} fn - 실행할 함수
 * @param {Object} options - 재시도 옵션
 * @returns {Promise} 실행 결과
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    abortSignal = null
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // AbortSignal 확인
      if (abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      console.log(`🔄 재시도 시도 ${attempt + 1}/${maxRetries + 1}`);
      
      const result = await fn();
      
      if (attempt > 0) {
        console.log(`✅ 재시도 성공 (${attempt + 1}번째 시도)`);
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // 마지막 시도가 아니면 대기
      if (attempt < maxRetries) {
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
        
        console.log(`⏳ 재시도 대기: ${delay}ms (오류: ${error.message})`);
        
        await sleep(delay);
      } else {
        console.error(`❌ 최대 재시도 횟수 초과 (${maxRetries + 1}회)`);
      }
    }
  }
  
  throw lastError;
}

/**
 * 배치 단위로 데이터 처리
 * @param {Array} items - 처리할 데이터 배열
 * @param {Function} processor - 배치 처리 함수
 * @param {Object} options - 배치 옵션
 * @returns {Promise<Object>} 처리 결과
 */
async function processBatches(items, processor, options = {}) {
  const {
    batchSize = 200,
    maxRetries = 3,
    abortSignal = null
  } = options;
  
  const totalItems = items.length;
  const totalBatches = Math.ceil(totalItems / batchSize);
  
  console.log(`📦 배치 처리 시작: ${totalItems}개 항목, ${totalBatches}개 배치`);
  
  let successCount = 0;
  let failureCount = 0;
  const failedBatches = [];
  
  for (let i = 0; i < totalBatches; i++) {
    // AbortSignal 확인
    if (abortSignal?.aborted) {
      throw new Error('Batch processing aborted');
    }
    
    const start = i * batchSize;
    const end = Math.min(start + batchSize, totalItems);
    const batch = items.slice(start, end);
    
    console.log(`📦 배치 ${i + 1}/${totalBatches} 처리 중: ${batch.length}개 항목`);
    
    try {
      await withRetry(
        () => processor(batch, i),
        {
          maxRetries,
          abortSignal
        }
      );
      
      successCount += batch.length;
      console.log(`✅ 배치 ${i + 1} 성공: ${batch.length}개 항목`);
      
    } catch (error) {
      failureCount += batch.length;
      failedBatches.push({
        batchIndex: i,
        items: batch,
        error: error.message
      });
      
      console.error(`❌ 배치 ${i + 1} 실패: ${error.message}`);
    }
  }
  
  return {
    totalItems,
    successCount,
    failureCount,
    failedBatches,
    success: failureCount === 0
  };
}

/**
 * 대기 함수
 * @param {number} ms - 대기 시간 (밀리초)
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 데드레터 큐에 실패한 배치 저장
 * @param {Array} failedBatches - 실패한 배치들
 * @param {Object} metadata - 메타데이터
 */
async function saveToDeadLetterQueue(failedBatches, metadata = {}) {
  if (failedBatches.length === 0) return;
  
  console.log(`💀 데드레터 큐에 ${failedBatches.length}개 배치 저장`);
  
  const deadLetterData = {
    timestamp: new Date().toISOString(),
    metadata,
    batches: failedBatches
  };
  
  // 로컬 파일 시스템에 저장 (실제로는 Redis나 별도 DB 사용 권장)
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const deadLetterDir = path.join(__dirname, '..', 'dead-letter-queue');
    await fs.mkdir(deadLetterDir, { recursive: true });
    
    const filename = `failed-batch-${Date.now()}.json`;
    const filepath = path.join(deadLetterDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(deadLetterData, null, 2));
    console.log(`💀 데드레터 큐 저장 완료: ${filename}`);
    
  } catch (error) {
    console.error('❌ 데드레터 큐 저장 실패:', error);
  }
}

module.exports = {
  withRetry,
  processBatches,
  saveToDeadLetterQueue,
  sleep
};
