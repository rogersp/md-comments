/* Link routing for the standalone comment preview panel. */
(function () {
  const model = window.mdCommentsNavModel;
  const docEl = document.querySelector('.md-comments-document');
  if (!model || !docEl) {
    return;
  }

  function findTarget(id) {
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  function scrollToElement(el) {
    const bar = document.getElementById('md-comments-navbar');
    const offset = (bar ? bar.offsetHeight : 0) + 8;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
    el.classList.add('md-comments-nav-target');
    setTimeout(function () {
      el.classList.remove('md-comments-nav-target');
    }, 1500);
  }

  function jumpTo(id) {
    const el = findTarget(id);
    if (!el) {
      return false;
    }
    scrollToElement(el);
    return true;
  }

  function linkFromEvent(e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !docEl.contains(a) || a.closest('[data-md-action], [role="button"]')) {
      return null;
    }
    return a;
  }

  function followLink(e) {
    const a = linkFromEvent(e);
    if (!a) {
      return;
    }
    const action = model.classifyHref(a.getAttribute('href'));
    if (action.kind !== 'fragment') {
      return;
    }
    // Stop VS Code's own webview link handler from seeing a link we handled.
    e.preventDefault();
    e.stopPropagation();
    jumpTo(action.id);
  }

  document.addEventListener('click', function (e) {
    if (e.button === 0) {
      followLink(e);
    }
  });

  window.mdCommentsNav = { jumpTo: jumpTo };
})();
