/**
 * 09:00 ~ 18:00 (KST) 유효 경과 시간을 계산하는 함수
 */
export function getBusinessHoursDiff(updatedAt: string | Date | null | undefined): number {
  if (!updatedAt) return 0;

  const start = new Date(updatedAt);
  const end = new Date();

  // 1. 시작 시각(updated_at) 보정: 18시 이후면 익일 09시, 09시 이전이면 당일 09시
  if (start.getHours() >= 18) {
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
  } else if (start.getHours() < 9) {
    start.setHours(9, 0, 0, 0);
  }

  // 2. 종료 시각(현재 시각) 보정: 18시 이후면 당일 18시, 09시 이전이면 전일 18시
  if (end.getHours() >= 18) {
    end.setHours(18, 0, 0, 0);
  } else if (end.getHours() < 9) {
    end.setDate(end.getDate() - 1);
    end.setHours(18, 0, 0, 0);
  }

  if (start >= end) return 0;

  let totalMs = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const finalDay = new Date(end);
  finalDay.setHours(0, 0, 0, 0);

  // 날짜별로 09:00 ~ 18:00 구간만 누적 합산
  while (current <= finalDay) {
    const dayStart = new Date(current);
    dayStart.setHours(9, 0, 0, 0);

    const dayEnd = new Date(current);
    dayEnd.setHours(18, 0, 0, 0);

    const validStart = Math.max(start.getTime(), dayStart.getTime());
    const validEnd = Math.min(end.getTime(), dayEnd.getTime());

    if (validEnd > validStart) {
      totalMs += (validEnd - validStart);
    }

    current.setDate(current.getDate() + 1);
  }

  return totalMs / (1000 * 60 * 60); // 시간(hours) 단위 반환
}

/**
 * 경과 시간에 따른 단계/증분값 반환
 */
export function getSeatBidTier(updatedAt: string | Date | null | undefined) {
  const diffHours = getBusinessHoursDiff(updatedAt);

  if (diffHours < 2) {
    return { tier: 1, priceChange: 500, label: '2시간 이내', diffHours };
  }
  if (diffHours < 4) {
    return { tier: 2, priceChange: 1000, label: '2시간 경과', diffHours };
  }
  if (diffHours < 6) {
    return { tier: 3, priceChange: 1500, label: '4시간 경과', diffHours };
  }
  return { tier: 4, priceChange: 2000, label: '6시간 경과 (최대)', diffHours };
}