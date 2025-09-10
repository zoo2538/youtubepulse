import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 한국 시간(KST, UTC+9) 관련 유틸리티 함수들
export function getKoreanDate(): Date {
  const now = new Date();
  // 한국 시간대로 변환 (UTC+9)
  const koreanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  return koreanTime;
}

export function getKoreanDateString(): string {
  const now = new Date();
  // 한국 시간대 기준으로 날짜 문자열 생성
  const koreanDateString = now.toLocaleDateString("en-CA", {timeZone: "Asia/Seoul"}); // YYYY-MM-DD 형식
  return koreanDateString;
}

export function getKoreanDateTimeString(): string {
  const koreanDate = getKoreanDate();
  return koreanDate.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ 형식
}

export function getKoreanDateStringWithOffset(daysOffset: number): string {
  const koreanDate = getKoreanDate();
  koreanDate.setDate(koreanDate.getDate() + daysOffset);
  return koreanDate.toISOString().split('T')[0];
}

export function formatKoreanDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00+09:00'); // 한국 시간으로 파싱
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  });
}
