import { uuidv7 } from './uuid';

describe('uuidv7', () => {
  it('tiene formato UUID con versión 7 y variante RFC', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('codifica la marca de tiempo y se ordena cronológicamente', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a < b).toBe(true);
    expect(parseInt(a.replace(/-/g, '').slice(0, 12), 16)).toBe(1_700_000_000_000);
  });

  it('no repite valores', () => {
    const set = new Set(Array.from({ length: 10_000 }, () => uuidv7()));
    expect(set.size).toBe(10_000);
  });
});
