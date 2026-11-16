import { createDraw } from './draw';

let previous = '';
let draw: ReturnType<typeof createDraw> | undefined;
self.onmessage = (event: MessageEvent<{ anchors: string[] }>) => {
  try {
    const key = JSON.stringify(event.data.anchors);
    if (key !== previous || !draw) { draw = createDraw(event.data.anchors); previous = key; }
    if (!draw.total) throw new Error('이 고정 조원 구성으로는 편성할 수 없어요. 고정 조원을 바꿔주세요.');
    // Rejection sampling avoids modulo bias in the random rank.
    const limit = Math.floor(2 ** 32 / draw.total) * draw.total;
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    const groups = draw.at(value[0] % draw.total);
    const empty = event.data.anchors.flatMap((a, i) => a ? [] : [i]);
    for (let i = empty.length - 1; i > 0; i--) {
      const bound = Math.floor(2 ** 32 / (i + 1)) * (i + 1);
      do { crypto.getRandomValues(value); } while (value[0] >= bound);
      const j = value[0] % (i + 1);
      [groups[empty[i]], groups[empty[j]]] = [groups[empty[j]], groups[empty[i]]];
    }
    self.postMessage({ total: draw.total, groups });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '추첨 중 문제가 발생했어요.' });
  }
};
