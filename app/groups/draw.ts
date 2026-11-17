import { count, names } from './data';

export const groupSizes = [...Array(Math.floor(names.length / 2)).fill(2), ...(names.length % 2 ? [1] : [])];

export function createDraw(assignments: string[][]) {
  if (assignments.length !== groupSizes.length || assignments.some((g, i) => g.length > groupSizes[i])) throw new Error('각 조의 정원에 맞게 배정해주세요.');
  const fixed = assignments.map(g => g.filter(Boolean));
  const selected = fixed.flat();
  if (new Set(selected).size !== selected.length || selected.some(n => !names.includes(n))) throw new Error('조원은 중복 없이 선택해주세요.');
  const invalid = fixed.some(g => g.some((a, i) => g.slice(i + 1).some(b => count[names.indexOf(a)][names.indexOf(b)] !== 0)));
  const free = names.map((_, i) => i).filter(i => !selected.includes(names[i]));
  const adj = free.map((a, i) => free.reduce((m, b, j) => m | (i !== j && count[a][b] === 0 ? 1 << j : 0), 0));
  // Constrained groups first; empty groups are counted without group-order duplicates.
  const order = fixed.map((g, index) => ({ index, members: g, need: groupSizes[index] - g.length, capacity: groupSizes[index] })).sort((a,b) => Number(!a.members.length)-Number(!b.members.length) || a.need-b.need);
  const allowed = order.map(g => free.reduce((m,b,j) => m | (g.members.every(a => count[names.indexOf(a)][b] === 0) ? 1 << j : 0),0));
  const memo = Array.from({length:groupSizes.length},()=>new Map<number,number>());
  function* combinations(mask: number, need: number, picked = 0): Generator<number> {
    if (!need) { yield picked; return; }
    let candidates = mask;
    while(candidates) {
      const bit = candidates & -candidates; candidates ^= bit;
      yield* combinations(candidates & adj[31-Math.clz32(bit)], need-1, picked | bit);
    }
  }
  function* choices(k: number, mask: number): Generator<number> {
    const group = order[k];
    if (!group.members.length && group.capacity === 2) {
      const first = mask & -mask;
      if (first) yield* combinations((mask ^ first) & adj[31-Math.clz32(first)], 1, first);
    } else yield* combinations(mask & allowed[k], group.need);
  }
  function ways(k: number, mask: number): number {
    if (k === groupSizes.length) return mask === 0 ? 1 : 0;
    const cached = memo[k].get(mask); if(cached !== undefined) return cached;
    let total=0; for(const bits of choices(k,mask)) total+=ways(k+1,mask ^ bits);
    memo[k].set(mask,total); return total;
  }
  const full=(1 << free.length)-1;
  const total=invalid ? 0 : ways(0,full);
  function at(rank: number) {
    if(!Number.isInteger(rank)||rank<0||rank>=total) throw new Error('잘못된 추첨 번호입니다.');
    const groups=fixed.map(g=>[...g]);let mask=full;
    for(let k=0;k<groupSizes.length;k++) for(const bits of choices(k,mask)) {
      const next=mask ^ bits;const size=ways(k+1,next);
      if(rank>=size){rank-=size;continue;}
      groups[order[k].index].push(...free.filter((_,i)=>bits & (1<<i)).map(i=>names[i]));mask=next;break;
    }
    return groups;
  }
  function preview(person: string) {
    if (!names.includes(person)) throw new Error('명단에서 내 이름을 찾지 못했어요.');
    const result = new Map<string, { members: string[]; completions: number }>();
    if (!total) return [];
    let prefixes = new Map<number, number>([[full, 1]]);
    for (let k = 0; k < groupSizes.length; k++) {
      const nextPrefixes = new Map<number, number>();
      for (const [mask, prefixCount] of prefixes) for (const bits of choices(k, mask)) {
        const next = mask ^ bits;
        const suffixCount = ways(k + 1, next);
        if (!suffixCount) continue;
        const members = [...order[k].members, ...free.filter((_, i) => bits & (1 << i)).map(i => names[i])];
        if (members.includes(person)) {
          const sorted = members.sort((a,b) => names.indexOf(a)-names.indexOf(b));
          const key = sorted.join('|');
          const previous = result.get(key);
          result.set(key, { members: sorted, completions: (previous?.completions ?? 0) + prefixCount * suffixCount });
        }
        nextPrefixes.set(next, (nextPrefixes.get(next) ?? 0) + prefixCount);
      }
      prefixes = nextPrefixes;
    }
    return [...result.values()].sort((a,b) => b.completions-a.completions || a.members.join().localeCompare(b.members.join(), 'ko'));
  }
  return {total,at,preview};
}
