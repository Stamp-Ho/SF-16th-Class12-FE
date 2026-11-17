import { createDraw } from './draw';
self.onmessage = (event: MessageEvent<{ assignments: string[][]; person: string }>) => {
  try {
    const draw = createDraw(event.data.assignments);
    self.postMessage({ total: draw.total, previews: draw.preview(event.data.person) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '미리보기를 계산하지 못했어요.' });
  }
};
