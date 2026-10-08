import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

let model: any;

beforeAll(() => {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../vscode-extension/media/navModel.js'),
    'utf8'
  );
  const context: any = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context);
  model = context.window.mdCommentsNavModel;
});

describe('navModel.classifyHref', () => {
  it('keeps same-file fragments in the webview, decoded', () => {
    expect(model.classifyHref('#510-sender')).toEqual({ kind: 'fragment', id: '510-sender' });
    expect(model.classifyHref('#caf%C3%A9')).toEqual({ kind: 'fragment', id: 'café' });
    expect(model.classifyHref('#bad%E0%A4')).toEqual({ kind: 'fragment', id: 'bad%E0%A4' });
  });

  it('leaves links with a scheme to VS Code', () => {
    for (const href of [
      'https://example.com/',
      'mailto:a@b.c',
      'command:mdComments.signIn',
      '//cdn/x',
    ]) {
      expect(model.classifyHref(href)).toEqual({ kind: 'native' });
    }
  });

  it('sends relative and root-relative paths to the host', () => {
    expect(model.classifyHref('./other.md#s2')).toEqual({ kind: 'host', href: './other.md#s2' });
    expect(model.classifyHref('other.md')).toEqual({ kind: 'host', href: 'other.md' });
    expect(model.classifyHref('/docs/a.md')).toEqual({ kind: 'host', href: '/docs/a.md' });
  });

  it('ignores empty links', () => {
    expect(model.classifyHref(null)).toEqual({ kind: 'ignore' });
    expect(model.classifyHref('')).toEqual({ kind: 'ignore' });
    expect(model.classifyHref('#')).toEqual({ kind: 'ignore' });
  });
});

describe('navModel.visibleOutline', () => {
  const items = [
    { level: 1, text: 'Title' },
    { level: 2, text: 'Overview' },
    { level: 3, text: 'Background' },
    { level: 4, text: 'Deep detail' },
  ];

  it('limits by depth when there is no query', () => {
    expect(model.visibleOutline(items, 2, '').map((i: any) => i.text)).toEqual([
      'Title',
      'Overview',
    ]);
    expect(model.visibleOutline(items, 6, '  ').length).toBe(4);
  });

  it('searches every level when there is a query', () => {
    expect(model.visibleOutline(items, 2, 'DEEP').map((i: any) => i.text)).toEqual(['Deep detail']);
  });
});

describe('navModel.countOpenThreadsBySection', () => {
  it('counts a section with its subsections', () => {
    // H1, H2, H3, H2. Threads sit under heading index 2 (twice) and 3, and before any heading.
    expect(model.countOpenThreadsBySection([1, 2, 3, 2], [2, 2, 3, -1])).toEqual([3, 2, 2, 1]);
  });

  it('returns zeros when there are no threads', () => {
    expect(model.countOpenThreadsBySection([2, 2], [])).toEqual([0, 0]);
  });
});

describe('navModel.activeHeadingIndex', () => {
  it('picks the last heading at or above the offset line', () => {
    const tops = [0, 500, 1200];
    expect(model.activeHeadingIndex(tops, 0, 40)).toBe(0);
    expect(model.activeHeadingIndex(tops, 470, 40)).toBe(1);
    expect(model.activeHeadingIndex(tops, 2000, 40)).toBe(2);
    expect(model.activeHeadingIndex([100], 0, 40)).toBe(-1);
  });
});
