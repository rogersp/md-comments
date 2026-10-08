import { describe, it, expect } from 'vitest';
import { NavHistory } from '../vscode-extension/src/navHistory';

const at = (uri: string, scrollTop = 0) => ({ uri, scrollTop });

describe('NavHistory', () => {
  it('starts empty', () => {
    const h = new NavHistory();
    expect(h.canGoBack).toBe(false);
    expect(h.canGoForward).toBe(false);
    expect(h.peekBack()).toBeUndefined();
  });

  it('goes back and forward like a browser', () => {
    const h = new NavHistory();
    h.push(at('a', 10));
    h.push(at('b', 20));
    expect(h.peekBack()).toEqual(at('b', 20));
    h.commitBack(at('c', 30));
    expect(h.peekBack()).toEqual(at('a', 10));
    expect(h.peekForward()).toEqual(at('c', 30));
    h.commitForward(at('b', 25));
    expect(h.peekBack()).toEqual(at('b', 25));
    expect(h.canGoForward).toBe(false);
  });

  it('clears forward on a new push', () => {
    const h = new NavHistory();
    h.push(at('a'));
    h.commitBack(at('b'));
    h.push(at('a'));
    expect(h.canGoForward).toBe(false);
  });

  it('commits nothing when there is nothing to pop', () => {
    const h = new NavHistory();
    h.commitBack(at('a'));
    h.commitForward(at('a'));
    expect(h.canGoBack).toBe(false);
    expect(h.canGoForward).toBe(false);
  });

  it('drops an unreachable back entry so earlier ones stay reachable', () => {
    const h = new NavHistory();
    h.push(at('a', 10));
    h.push(at('gone', 20));
    h.dropBack();
    expect(h.peekBack()).toEqual(at('a', 10));
    expect(h.canGoForward).toBe(false);
  });

  it('drops an unreachable forward entry so later ones stay reachable', () => {
    const h = new NavHistory();
    h.push(at('a'));
    h.push(at('b'));
    h.commitBack(at('c', 30));
    h.commitBack(at('gone', 40));
    h.dropForward();
    expect(h.peekForward()).toEqual(at('c', 30));
    expect(h.peekBack()).toBeUndefined();
  });

  it('dropping from an empty list does nothing', () => {
    const h = new NavHistory();
    h.dropBack();
    h.dropForward();
    expect(h.canGoBack).toBe(false);
    expect(h.canGoForward).toBe(false);
  });

  it('drops the oldest entry past the limit', () => {
    const h = new NavHistory(2);
    h.push(at('a'));
    h.push(at('b'));
    h.push(at('c'));
    h.commitBack(at('x'));
    h.commitBack(at('y'));
    expect(h.canGoBack).toBe(false);
  });
});
