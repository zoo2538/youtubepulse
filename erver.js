[33m7a72d68[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m)[m feat: DB 전체 초기화 API 추가 - OOM 방지용
[33mea246c0[m fix: API 응답 래퍼 언래핑 수정 - 분류 데이터 캐시 저장 오류 해결
[33m2bb82cc[m feat: server date-specific merge KST + apiService import
[33m36d9ae7[m fix: implement batch upload for large datasets to prevent 413 error and increase server limit to 100MB
[33mc4c86d9[m fix: remove TypeScript type annotations from server.js
[33me57a475[m fix: add Railway health check endpoint /api/health
[33m6ee9148[m feat: complete operational system with server-first hybrid, backlog management, and automation
[33m24f8281[m feat: complete background sync with retry, toast, metrics, debug hooks, and health check
[33m62027be[m fix: hybrid sync to prioritize higher view count for duplicate videos on same date
[33mf144fa5[m fix: change from merge to overwrite for web classification data to ensure changes are saved
[33m6b687f3[m Add detailed PostgreSQL connection diagnostics
[33mcf3f75d[m Add PostgreSQL connection test API endpoint
[33m8ab83b7[m Add detailed error logging and API response for auto-collection debugging
[33m79ad036[m Add PostgreSQL connection test to auto-collection
[33mf162cdb[m Simplify auto-collection for testing: 1 page trending, 1 keyword only
[33m1424dcf[m Revert to original YouTube API code for testing
[33mbad85aa[m Add detailed YouTube API logging to diagnose auto-collection issues
[33m37263c6[m Add detailed logging to auto-collection function
[33m977dec7[m Fix auto-collection error handling and return values
[33mb9550e7[m Fix server authority hybrid principle
[33m65b6ce8[m fix: correct static file path for server running in dist/server directory
[33maff6d8b[m fix: use Express 5 compatible wildcard pattern /*splat instead of /*
[33md043bfd[m fix: change app.options from '*' to '/*' for Express Router compatibility
[33m498267c[m fix: make health check pass even if PostgreSQL connection fails
[33m98f7ff6[m fix: return all classified data rows instead of LIMIT 1
[33mbbd3a14[m fix: correct auto-collection cron schedule comment to midnight (00:00) and add logging
