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

  window.mdCommentsNavModel = {
    decodeFragment: decodeFragment,
    classifyHref: classifyHref,
  };
})();
