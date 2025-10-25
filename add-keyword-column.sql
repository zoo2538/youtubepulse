-- unclassified_data 테이블에 keyword 컬럼 추가
ALTER TABLE unclassified_data 
ADD COLUMN IF NOT EXISTS keyword VARCHAR(255);

-- keyword 컬럼에 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_unclassified_data_keyword 
ON unclassified_data(keyword);

-- 기존 데이터의 keyword 컬럼을 빈 문자열로 초기화
UPDATE unclassified_data 
SET keyword = '' 
WHERE keyword IS NULL;
