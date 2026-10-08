/* Link routing for the standalone comment preview panel. */
(function () {
  const model = window.mdCommentsNavModel;
  const vscode = window.__mdCommentsVsCodeApi;
  const docEl = document.querySelector('.md-comments-document');
  if (!model || !vscode || !docEl) {
    return;
  }

  function post(action, payload) {
    vscode.postMessage(Object.assign({ action: action }, payload || {}));
  }

  function currentScrollTop() {
    return Math.round(window.scrollY);
  }

  function findTarget(id) {
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  function alignTo(el) {
    const bar = document.getElementById('md-comments-navbar');
    const offset = (bar ? bar.offsetHeight : 0) + 8;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
  }

  // The sidebar and fonts can still be settling when a link is followed, which reflows the
  // document and pushes the target away. Re-align on each reflow until the user scrolls.
  let stopHolding = null;
  function holdAlignment(el) {
    if (stopHolding) {
      stopHolding();
    }
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    const userEvents = ['wheel', 'keydown', 'pointerdown', 'touchstart'];
    const observer = new ResizeObserver(function () {
      alignTo(el);
    });
    const timer = setTimeout(stop, 1500);
    function stop() {
      observer.disconnect();
      clearTimeout(timer);
      userEvents.forEach(function (name) {
        window.removeEventListener(name, stop);
      });
      stopHolding = null;
    }
    userEvents.forEach(function (name) {
      window.addEventListener(name, stop, { passive: true });
    });
    observer.observe(docEl);
    stopHolding = stop;
  }

  function scrollToElement(el) {
    alignTo(el);
    holdAlignment(el);
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

  function applyTarget(fragment, scrollTop) {
    const el = fragment ? findTarget(fragment) : null;
    if (el) {
      scrollToElement(el);
    } else if (typeof scrollTop === 'number' && !isNaN(scrollTop)) {
      window.scrollTo(0, scrollTop);
    }
  }

  function linkFromEvent(e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !docEl.contains(a) || a.closest('[data-md-action], [role="button"]')) {
      return null;
    }
    return a;
  }

  function followLink(e, newPanel) {
    const a = linkFromEvent(e);
    if (!a) {
      return;
    }
    const action = model.classifyHref(a.getAttribute('href'));
    if (action.kind === 'ignore' || action.kind === 'native') {
      return;
    }
    // Stop VS Code's own webview link handler from seeing a link we handled.
    e.preventDefault();
    e.stopPropagation();
    if (action.kind === 'fragment') {
      jumpTo(action.id);
    } else {
      post('nav-open-link', {
        href: action.href,
        newPanel: newPanel,
        scrollTop: currentScrollTop(),
      });
    }
  }

  document.addEventListener('click', function (e) {
    if (e.button === 0) {
      followLink(e, e.metaKey || e.ctrlKey);
    }
  });
  document.addEventListener('auxclick', function (e) {
    if (e.button === 1) {
      followLink(e, true);
    }
  });

  window.addEventListener('message', function (event) {
    const msg = event.data;
    if (msg && msg.type === 'navScrollTo') {
      applyTarget(msg.fragment || '', msg.scrollTop);
    }
  });

  window.mdCommentsNav = { jumpTo: jumpTo };

  const initialFragment = document.body.getAttribute('data-md-nav-fragment') || '';
  const initialScroll = document.body.getAttribute('data-md-nav-scroll');
  requestAnimationFrame(function () {
    applyTarget(initialFragment, initialScroll ? Number(initialScroll) : NaN);
  });
})();
