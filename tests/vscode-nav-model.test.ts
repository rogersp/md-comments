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
