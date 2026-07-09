// 金額千分位（整數）
export function money(n: number): string {
  return n.toLocaleString("en-US");
}

// 日期時間格式化
export function dt(d: Date | string): string {
  const date = new Date(d);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
