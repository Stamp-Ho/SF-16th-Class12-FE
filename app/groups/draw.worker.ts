import { createDraw } from './draw';

type Request = { type: 'check' | 'draw'; assignments: string[][] };
let previous = '';
let draw: ReturnType<typeof createDraw> | undefined;
function randomBelow(max: number) {
  // 53 random bits also support totals above the 32-bit range.
  if (!Number.isSafeInteger(max) || max <= 0) throw new Error('추첨 범위를 확인해주세요.');
  const range = 2 ** 53;
  const limit = Math.floor(range / max) * max;
  const words = new Uint32Array(2);
  let value: number;
  do { crypto.getRandomValues(words); value = (words[0] & 0x1fffff) * 2 ** 32 + words[1]; } while (value >= limit);
  return value % max;
}
self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const { type, assignments } = event.data;
    const key = JSON.stringify(assignments);
    if (key !== previous || !draw) { draw = createDraw(assignments); previous = key; }
    if (type === 'check' || !draw.total) { self.postMessage({ type, total: draw.total }); return; }
    const groups = draw.at(randomBelow(draw.total));
    const empty = assignments.flatMap((g, i) => g.some(Boolean) ? [] : [i]);
    for (let i = empty.length - 1; i > 0; i--) {
      const j = randomBelow(i + 1);
      [groups[empty[i]], groups[empty[j]]] = [groups[empty[j]], groups[empty[i]]];
    }
    self.postMessage({ type, total: draw.total, groups });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '추첨 중 오류가 발생했어요.' });
  }
};
