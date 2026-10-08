import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

// markdown-it is a dependency of the extension package, not of the workspace root.
const MarkdownIt = createRequire(path.resolve(__dirname, '../vscode-extension/package.json'))(
  'markdown-it'
);
import { GitHubSlugger, headingIdsPlugin } from '../vscode-extension/src/headingIds';

function render(src: string): string {
  return new MarkdownIt({ html: true, linkify: true, typographer: true })
    .use(headingIdsPlugin)
    .render(src);
}

describe('GitHubSlugger', () => {
  it('builds the ids GitHub builds', () => {
    const slugger = new GitHubSlugger();
    expect(slugger.slug('5.10 Sender identities and signatures')).toBe(
      '510-sender-identities-and-signatures'
    );
    expect(slugger.slug('Figure 1 · The message lifecycle')).toBe(
      'figure-1--the-message-lifecycle'
    );
    expect(slugger.slug('"Regarding" is separate from "To"')).toBe('regarding-is-separate-from-to');
    expect(slugger.slug('Party roles: toRoles, ccRoles')).toBe('party-roles-toroles-ccroles');
    expect(slugger.slug('snake_case and kebab-case')).toBe('snake_case-and-kebab-case');
    expect(slugger.slug('Ünïcode ✅ heading')).toBe('ünïcode--heading');
  });

  it('numbers repeated headings the way GitHub does', () => {
    const slugger = new GitHubSlugger();
    expect(['Overview', 'Overview', 'Overview-1', 'Overview'].map((t) => slugger.slug(t))).toEqual([
      'overview',
      'overview-1',
      'overview-1-1',
      'overview-2',
    ]);
  });
});

describe('headingIdsPlugin', () => {
  it('slugs the source text before the typographer rewrites it', () => {
    expect(render('## 5.10 Sender `identities` -- and **signatures**\n')).toContain(
      '<h2 id="510-sender-identities----and-signatures">'
    );
  });

  it('leaves inline HTML out of the id and keeps the anchor', () => {
    const html = render('## <a id="s2"></a>S2 · Second scenario\n');
    expect(html).toContain('<h2 id="s2--second-scenario">');
    expect(html).toContain('<a id="s2"></a>');
  });

  it('numbers duplicates within one document and restarts for the next', () => {
    const md = new MarkdownIt().use(headingIdsPlugin);
    expect(md.render('# A\n\n## A\n')).toContain('<h2 id="a-1">');
    expect(md.render('# A\n')).toContain('<h1 id="a">');
  });

  it('gives a heading with no text no id', () => {
    expect(render('## <a id="x"></a>\n')).toContain('<h2><a id="x"></a></h2>');
  });
});
