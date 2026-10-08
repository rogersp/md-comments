/* Pure helpers for link routing and the outline. No DOM access, so tests run them in a VM. */
(function () {
  const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

  function decodeFragment(raw) {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  // Same-file fragments are handled in the webview and other relative links by the extension
  // host. Links with a scheme (https:, mailto:, command:) are left to VS Code's own handling.
  function classifyHref(href) {
    if (!href || href === '#') {
      return { kind: 'ignore' };
    }
    if (href.charAt(0) === '#') {
      const id = decodeFragment(href.slice(1));
      return id ? { kind: 'fragment', id: id } : { kind: 'ignore' };
    }
    if (SCHEME_RE.test(href) || href.indexOf('//') === 0) {
      return { kind: 'native' };
    }
    return { kind: 'host', href: href };
  }

  // A filter query searches every level; otherwise the depth setting applies.
  function visibleOutline(items, maxDepth, query) {
    const q = (query || '').trim().toLowerCase();
    if (q) {
      return items.filter(function (item) {
        return item.text.toLowerCase().indexOf(q) !== -1;
      });
    }
    return items.filter(function (item) {
      return item.level <= maxDepth;
    });
  }

  // `sections` holds, for each open thread, the index of the heading it sits under (-1 when
  // it comes before the first heading). A heading's count includes its subsections.
  function countOpenThreadsBySection(levels, sections) {
    return levels.map(function (level, i) {
      let end = levels.length;
      for (let j = i + 1; j < levels.length; j++) {
        if (levels[j] <= level) {
          end = j;
          break;
        }
      }
      return sections.filter(function (s) {
        return s >= i && s < end;
      }).length;
    });
  }

  // `tops` are ascending document offsets of the headings.
  function activeHeadingIndex(tops, scrollTop, offset) {
    let active = -1;
    for (let i = 0; i < tops.length; i++) {
      if (tops[i] <= scrollTop + offset) {
        active = i;
      } else {
        break;
      }
    }
    return active;
  }

  window.mdCommentsNavModel = {
    decodeFragment: decodeFragment,
    classifyHref: classifyHref,
    visibleOutline: visibleOutline,
    countOpenThreadsBySection: countOpenThreadsBySection,
    activeHeadingIndex: activeHeadingIndex,
  };
})();
