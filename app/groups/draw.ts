import { count, names } from './data';

// Count unanchored groups canonically, then shuffle their group numbers at draw time.
export function createDraw(anchors: string[]) {
  const selected = anchors.filter(Boolean);
  if (anchors.length !== 9 || new Set(selected).size !== selected.length || selected.some(a => !names.includes(a))) {
    throw new Error('고정 조원은 중복 없이 선택해주세요.');
  }
  const fixed = selected.map(a => names.indexOf(a));
  const free = names.map((_, i) => i).filter(i => !fixed.includes(i));
  const adj = free.map((a, i) => free.reduce((m, b, j) => m | (i !== j && count[a][b] === 0 ? 1 << j : 0), 0));
  const allowed = fixed.map(a => free.reduce((m, b, j) => m | (count[a][b] === 0 ? 1 << j : 0), 0));
  const memo = Array.from({ length: 10 }, () => new Map<number, number>());
  function* choices(k: number, mask: number): Generator<number[]> {
    const first = k < fixed.length ? 0 : mask & -mask;
    const rest = mask ^ first;
    let bs = k < fixed.length ? rest & allowed[k] : rest & adj[31 - Math.clz32(first)];
    while (bs) {
      const b = bs & -bs; bs ^= b;
      let cs = bs & adj[31 - Math.clz32(b)];
      while (cs) { const c = cs & -cs; cs ^= c; yield first ? [first, b, c] : [b, c]; }
    }
  }
  function ways(k: number, mask: number): number {
    if (!mask) return 1;
    const cached = memo[k].get(mask);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const bits of choices(k, mask)) total += ways(k + 1, mask ^ bits.reduce((a, b) => a | b, 0));
    memo[k].set(mask, total);
    return total;
  }
  const full = (1 << free.length) - 1;
  const total = ways(0, full);
  function at(rank: number) {
    if (!Number.isInteger(rank) || rank < 0 || rank >= total) throw new Error('잘못된 추첨 번호입니다.');
    let mask = full;
    const groups: string[][] = Array.from({ length: 9 }, () => []);
    const empty = anchors.flatMap((a, i) => a ? [] : [i]);
    for (let k = 0; k < 9; k++) {
      for (const bits of choices(k, mask)) {
        const next = mask ^ bits.reduce((a, b) => a | b, 0);
        const size = ways(k + 1, next);
        if (rank >= size) { rank -= size; continue; }
        const members = bits.map(b => names[free[31 - Math.clz32(b)]]);
        if (k < fixed.length) groups[anchors.indexOf(selected[k])] = [selected[k], ...members];
        else groups[empty[k - fixed.length]] = members;
        mask = next;
        break;
      }
    }
    return groups;
  }
  return { total, at };
}
