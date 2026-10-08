/* eslint-disable @typescript-eslint/no-explicit-any */

// GitHub keeps letters, marks, numbers, connector punctuation, hyphens and spaces when it
// builds a heading id. Matching it lets links written for GitHub work in the preview.
const STRIP_RE = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;

export class GitHubSlugger {
  private readonly occurrences = new Map<string, number>();

  slug(text: string): string {
    const base = text.toLowerCase().replace(STRIP_RE, '').replace(/ /g, '-');
    let slug = base;
    while (this.occurrences.has(slug)) {
      const next = (this.occurrences.get(base) ?? 0) + 1;
      this.occurrences.set(base, next);
      slug = `${base}-${next}`;
    }
    this.occurrences.set(slug, 0);
    return slug;
  }
}

const TEXT_TOKENS = new Set(['text', 'text_special', 'code_inline']);

export function headingText(inline: any): string {
  return (inline?.children ?? [])
    .filter((token: any) => TEXT_TOKENS.has(token.type))
    .map((token: any) => token.content)
    .join('');
}

// Runs before 'replacements' so the typographer has not yet turned "--" or straight quotes
// into characters GitHub would slug differently.
export function headingIdsPlugin(md: any): void {
  md.core.ruler.before('replacements', 'md_comments_heading_ids', (state: any) => {
    const slugger = new GitHubSlugger();
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'heading_open' || tokens[i].attrGet('id')) {
        continue;
      }
      const text = headingText(tokens[i + 1]);
      if (text.trim()) {
        tokens[i].attrSet('id', slugger.slug(text));
      }
    }
  });
}
