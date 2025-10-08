#!/bin/bash

# YouTube Pulse 배포 스크립트
# GitHub Pages와 Railway 배포를 자동화합니다.

set -e  # 오류 발생 시 즉시 종료

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo -e "\n${CYAN}================================================${NC}"
    echo -e "${CYAN}🔍 $1${NC}"
    echo -e "${CYAN}================================================${NC}"
}

# 환경 변수 확인
check_environment() {
    log_section "환경 변수 확인"
    
    if [ -z "$GITHUB_TOKEN" ]; then
        log_warning "GITHUB_TOKEN이 설정되지 않았습니다."
        log_info "GitHub Pages 배포는 건너뜁니다."
        SKIP_GITHUB=true
    else
        log_success "GITHUB_TOKEN 확인됨"
        SKIP_GITHUB=false
    fi
    
    if [ -z "$RAILWAY_TOKEN" ]; then
        log_warning "RAILWAY_TOKEN이 설정되지 않았습니다."
        log_info "Railway 배포는 건너뜁니다."
        SKIP_RAILWAY=true
    else
        log_success "RAILWAY_TOKEN 확인됨"
        SKIP_RAILWAY=false
    fi
}

# 린터 및 타입 체크
run_quality_checks() {
    log_section "코드 품질 검사"
    
    log_info "ESLint 실행 중..."
    if npm run lint; then
        log_success "ESLint 통과"
    else
        log_error "ESLint 실패"
        exit 1
    fi
    
    log_info "TypeScript 타입 체크 중..."
    if npm run type-check; then
        log_success "TypeScript 타입 체크 통과"
    else
        log_error "TypeScript 타입 체크 실패"
        exit 1
    fi
}

# 프론트엔드 빌드
build_frontend() {
    log_section "프론트엔드 빌드"
    
    log_info "의존성 설치 중..."
    npm install
    
    log_info "프로덕션 빌드 중..."
    npm run build
    
    if [ -d "dist" ]; then
        log_success "프론트엔드 빌드 완료"
        
        # 빌드 결과 확인
        log_info "빌드 결과 확인:"
        echo "  - index.html: $(test -f dist/index.html && echo "✅" || echo "❌")"
        echo "  - 404.html: $(test -f dist/404.html && echo "✅" || echo "❌")"
        echo "  - assets 폴더: $(test -d dist/assets && echo "✅" || echo "❌")"
        
        # assets 폴더의 파일 수 확인
        if [ -d "dist/assets" ]; then
            ASSET_COUNT=$(find dist/assets -type f | wc -l)
            log_info "assets 파일 수: $ASSET_COUNT개"
        fi
    else
        log_error "빌드 실패: dist 폴더가 생성되지 않음"
        exit 1
    fi
}

# 백엔드 서버 파일 복사
copy_server_files() {
    log_section "백엔드 서버 파일 복사"
    
    log_info "서버 파일들을 dist 폴더로 복사 중..."
    
    # server.js 복사
    if [ -f "server.js" ]; then
        cp server.js dist/server/
        log_success "server.js 복사 완료"
    else
        log_error "server.js 파일을 찾을 수 없습니다"
        exit 1
    fi
    
    # package.json 복사 (서버 의존성용)
    if [ -f "package.json" ]; then
        cp package.json dist/server/
        log_success "package.json 복사 완료"
    fi
    
    # Procfile 복사 (Railway 배포용)
    if [ -f "Procfile" ]; then
        cp Procfile dist/server/
        log_success "Procfile 복사 완료"
    fi
    
    # railway.json 복사 (Railway 설정용)
    if [ -f "railway.json" ]; then
        cp railway.json dist/server/
        log_success "railway.json 복사 완료"
    fi
}

# GitHub Pages 배포
deploy_to_github_pages() {
    if [ "$SKIP_GITHUB" = true ]; then
        log_warning "GitHub Pages 배포 건너뜀"
        return
    fi
    
    log_section "GitHub Pages 배포"
    
    # Git 상태 확인
    if ! git status --porcelain | grep -q .; then
        log_info "커밋할 변경사항이 없습니다."
    else
        log_info "변경사항 커밋 중..."
        git add .
        git commit -m "feat: deploy $(date '+%Y-%m-%d %H:%M:%S')"
        log_success "커밋 완료"
    fi
    
    # GitHub Pages에 배포 (gh-pages 브랜치)
    log_info "GitHub Pages에 배포 중..."
    
    # gh-pages 패키지가 없으면 설치
    if ! npm list gh-pages > /dev/null 2>&1; then
        log_info "gh-pages 패키지 설치 중..."
        npm install --save-dev gh-pages
    fi
    
    # GitHub Pages 배포
    if npm run deploy; then
        log_success "GitHub Pages 배포 완료"
        
        # 배포된 URL 확인
        DEPLOYED_URL="https://zoo2538.github.io/youtubepulse/"
        log_info "배포된 URL: $DEPLOYED_URL"
        
        # 캐시 무효화를 위한 쿼리 파라미터 추가 URL
        CACHE_BUST_URL="${DEPLOYED_URL}?v=$(date +%s)"
        log_info "캐시 무효화 URL: $CACHE_BUST_URL"
        
    else
        log_error "GitHub Pages 배포 실패"
        exit 1
    fi
}

# Railway 배포
deploy_to_railway() {
    if [ "$SKIP_RAILWAY" = true ]; then
        log_warning "Railway 배포 건너뜀"
        return
    fi
    
    log_section "Railway 배포"
    
    # Railway CLI 설치 확인
    if ! command -v railway &> /dev/null; then
        log_info "Railway CLI 설치 중..."
        npm install -g @railway/cli
    fi
    
    # Railway 로그인 확인
    if ! railway whoami &> /dev/null; then
        log_info "Railway에 로그인 중..."
        echo "$RAILWAY_TOKEN" | railway auth
    fi
    
    # Railway 배포
    log_info "Railway에 배포 중..."
    cd dist/server
    
    if railway deploy --service youtubepulse-backend; then
        log_success "Railway 배포 완료"
        
        # 배포된 서비스 URL 확인
        SERVICE_URL=$(railway domain)
        log_info "배포된 서비스 URL: $SERVICE_URL"
        
        # 헬스 체크 실행
        log_info "헬스 체크 실행 중..."
        if curl -s "$SERVICE_URL/health/db" | grep -q '"status":"UP"'; then
            log_success "헬스 체크 통과"
        else
            log_warning "헬스 체크 실패 또는 서비스가 아직 준비되지 않음"
        fi
        
    else
        log_error "Railway 배포 실패"
        exit 1
    fi
    
    cd ../..
}

# 배포 후 검증
verify_deployment() {
    log_section "배포 검증"
    
    # GitHub Pages 검증
    if [ "$SKIP_GITHUB" = false ]; then
        log_info "GitHub Pages 검증 중..."
        GITHUB_URL="https://zoo2538.github.io/youtubepulse/"
        
        if curl -s -o /dev/null -w "%{http_code}" "$GITHUB_URL" | grep -q "200"; then
            log_success "GitHub Pages 접근 가능"
        else
            log_warning "GitHub Pages 접근 실패 (배포가 아직 진행 중일 수 있음)"
        fi
    fi
    
    # Railway 검증
    if [ "$SKIP_RAILWAY" = false ]; then
        log_info "Railway API 서버 검증 중..."
        
        # Railway 서비스 URL 확인
        if [ -n "$SERVICE_URL" ]; then
            if curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health/db" | grep -q "200"; then
                log_success "Railway API 서버 접근 가능"
            else
                log_warning "Railway API 서버 접근 실패"
            fi
        fi
    fi
}

# 전체 배포 과정 실행
main() {
    log_section "YouTube Pulse 배포 시작"
    log_info "시작 시간: $(date '+%Y-%m-%d %H:%M:%S')"
    
    # 1. 환경 변수 확인
    check_environment
    
    # 2. 코드 품질 검사
    run_quality_checks
    
    # 3. 프론트엔드 빌드
    build_frontend
    
    # 4. 백엔드 서버 파일 복사
    copy_server_files
    
    # 5. GitHub Pages 배포
    deploy_to_github_pages
    
    # 6. Railway 배포
    deploy_to_railway
    
    # 7. 배포 검증
    verify_deployment
    
    # 완료 메시지
    log_section "배포 완료"
    log_success "모든 배포 작업이 완료되었습니다!"
    log_info "완료 시간: $(date '+%Y-%m-%d %H:%M:%S')"
    
    if [ "$SKIP_GITHUB" = false ]; then
        log_info "🌐 프론트엔드: https://zoo2538.github.io/youtubepulse/"
    fi
    
    if [ "$SKIP_RAILWAY" = false ]; then
        log_info "🚂 백엔드 API: $SERVICE_URL"
    fi
}

# 스크립트 실행
main "$@"
