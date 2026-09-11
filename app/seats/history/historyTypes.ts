export type BidHistoryRecord = {
  id: number;
  user_name: string;
  price_change: number;
  bid_price: number;
  seat_code: string;
  category: "이동" | "입찰" | "도박";
  method: string;
  created_at: string;
  prev_group_name: string | null;
  next_group_name: string | null;
};

// "26.08.21 16:09:12" 형태로 변환
export function formatDate(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${MM}월 ${dd}일`;
}
export function formatTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${hh}:${mm}:${ss}`;
}
