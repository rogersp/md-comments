import { describe, it, expect } from 'vitest';
import { isMarkdownPath, opensNewPanel, resolveLink } from '../vscode-extension/src/links';

describe('resolveLink', () => {
  it('resolves against the current file folder, keeping the fragment', () => {
    expect(resolveLink('docs/design/plan.md', './scenarios.md#s3')).toEqual({
      kind: 'file',
      relPath: 'docs/design/scenarios.md',
      fragment: 's3',
    });
    expect(resolveLink('docs/design/plan.md', '../../reference/x.md')).toEqual({
      kind: 'file',
      relPath: 'reference/x.md',
      fragment: undefined,
    });
  });

  it('resolves a leading slash against the workspace folder', () => {
    expect(resolveLink('docs/a.md', '/README.md')).toEqual({
      kind: 'file',
      relPath: 'README.md',
      fragment: undefined,
    });
  });

  it('decodes the path and fragment and drops a query', () => {
    expect(resolveLink('a.md', 'my%20file.md?plain=1#caf%C3%A9')).toEqual({
      kind: 'file',
      relPath: 'my file.md',
      fragment: 'café',
    });
  });

  it('treats a bare fragment or a self link as the current file', () => {
    expect(resolveLink('docs/a.md', '#x')).toEqual({
      kind: 'file',
      relPath: 'docs/a.md',
      fragment: 'x',
    });
    expect(resolveLink('docs/a.md', './a.md#x')).toEqual({
      kind: 'file',
      relPath: 'docs/a.md',
      fragment: 'x',
    });
  });

  it('rejects links that leave the workspace folder or use backslashes', () => {
    expect(resolveLink('docs/a.md', '../../x.md').kind).toBe('invalid');
    expect(resolveLink('a.md', '..\\x.md').kind).toBe('invalid');
  });

  it('passes web links through and rejects other schemes', () => {
    expect(resolveLink('a.md', 'https://example.com/x')).toEqual({
      kind: 'external',
      url: 'https://example.com/x',
    });
    expect(resolveLink('a.md', 'javascript:alert(1)').kind).toBe('invalid');
  });
});

describe('isMarkdownPath', () => {
  it('accepts .md and .markdown in any case', () => {
    expect(isMarkdownPath('a/b.md')).toBe(true);
    expect(isMarkdownPath('B.MARKDOWN')).toBe(true);
    expect(isMarkdownPath('diagram.svg')).toBe(false);
  });
});

describe('opensNewPanel', () => {
  it('inverts the setting when a modifier is held', () => {
    expect(opensNewPanel('inPanel', false)).toBe(false);
    expect(opensNewPanel('inPanel', true)).toBe(true);
    expect(opensNewPanel('newPanel', false)).toBe(true);
    expect(opensNewPanel('newPanel', true)).toBe(false);
    expect(opensNewPanel(undefined, false)).toBe(false);
  });
});
