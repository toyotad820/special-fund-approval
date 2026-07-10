// 金額千分位（整數）
export function money(n: number): string {
  return n.toLocaleString("en-US");
}

// 課別正規化：去除純數字前導零（"01"→"1"），確保不同輸入來源（表單/CSV/後台）
// 存出來的值一致，才能用字串比對正確配對到課長帳號。非數字格式原樣保留。
export function normalizeDeptCode(v: string | null | undefined): string {
  const s = String(v ?? "").trim();
  if (s === "" || !/^\d+$/.test(s)) return s;
  return String(parseInt(s, 10));
}

// 日期時間格式化
export function dt(d: Date | string): string {
  const date = new Date(d);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
