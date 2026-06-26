export function withinSeconds(ts1: string, ts2: string, seconds: number): boolean {
  const diff = Math.abs(new Date(ts1).getTime() - new Date(ts2).getTime());
  return diff <= seconds * 1000;
}
