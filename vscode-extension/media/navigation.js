/* Link routing, navigation bar and back/forward for the standalone comment preview panel. */
(function () {
  const model = window.mdCommentsNavModel;
  const vscode = window.__mdCommentsVsCodeApi;
  const docEl = document.querySelector('.md-comments-document');
  const main = document.querySelector('.md-comments-main');
  if (!model || !vscode || !docEl || !main) {
    return;
  }

  function post(action, payload) {
    vscode.postMessage(Object.assign({ action: action }, payload || {}));
  }

  function currentScrollTop() {
    return Math.round(window.scrollY);
  }

  function makeNavButton(nav, label, text) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'md-comments-nav-btn';
    btn.setAttribute('data-nav', nav);
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.textContent = text;
    btn.disabled = true;
    return btn;
  }

  const navbar = document.createElement('div');
  navbar.id = 'md-comments-navbar';
  navbar.className = 'md-comments-navbar';
  const backBtn = makeNavButton('back', 'Back', '←');
  const forwardBtn = makeNavButton('forward', 'Forward', '→');
  const title = document.createElement('span');
  title.className = 'md-comments-nav-title';
  title.textContent = document.body.getAttribute('data-md-nav-title') || '';
  navbar.append(backBtn, forwardBtn, title);
  main.insertBefore(navbar, main.firstChild);

  function findTarget(id) {
    return document.getElementById(id) || document.getElementsByName(id)[0] || null;
  }

  function alignTo(el) {
    const offset = navbar.offsetHeight + 8;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
  }

  // The sidebar, fonts and images can still be settling when a link is followed or a position
  // is restored, which reflows the document and moves the target. Re-apply `align` on each
  // reflow until the user scrolls. Only one hold runs at a time.
  let stopHolding = null;
  function holdAlignment(align) {
    if (stopHolding) {
      stopHolding();
    }
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    const userEvents = ['wheel', 'keydown', 'pointerdown', 'touchstart'];
    const observer = new ResizeObserver(align);
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
    holdAlignment(function () {
      alignTo(el);
    });
    el.classList.add('md-comments-nav-target');
    setTimeout(function () {
      el.classList.remove('md-comments-nav-target');
    }, 1500);
  }

  // Records where the reader was, so Back returns there, then jumps.
  function jumpTo(id) {
    const el = findTarget(id);
    if (!el) {
      return false;
    }
    post('nav-push', { scrollTop: currentScrollTop() });
    scrollToElement(el);
    return true;
  }

  function applyTarget(fragment, scrollTop) {
    const el = fragment ? findTarget(fragment) : null;
    if (el) {
      scrollToElement(el);
    } else if (typeof scrollTop === 'number' && !isNaN(scrollTop)) {
      window.scrollTo(0, scrollTop);
      holdAlignment(function () {
        window.scrollTo(0, scrollTop);
      });
    } else if (stopHolding) {
      stopHolding();
    }
  }

  function navigate(direction) {
    post(direction === 'back' ? 'nav-back' : 'nav-forward', { scrollTop: currentScrollTop() });
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

  backBtn.addEventListener('click', function () {
    navigate('back');
  });
  forwardBtn.addEventListener('click', function () {
    navigate('forward');
  });

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
  // Mouse side buttons arrive as buttons 3/4. VS Code's own handler for them listens on the
  // workbench document, which never sees events inside a webview, so the panel handles them.
  // Act on mousedown, as VS Code does, and swallow the rest of the gesture so the browser never
  // runs its own history navigation.
  document.addEventListener('mousedown', function (e) {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      navigate(e.button === 3 ? 'back' : 'forward');
    }
  });
  ['mouseup', 'auxclick'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
      }
    });
  });

  window.addEventListener('message', function (event) {
    const msg = event.data;
    if (!msg) {
      return;
    }
    if (msg.type === 'navScrollTo') {
      applyTarget(msg.fragment || '', msg.scrollTop);
    } else if (msg.type === 'navState') {
      backBtn.disabled = !msg.canGoBack;
      forwardBtn.disabled = !msg.canGoForward;
    } else if (msg.type === 'navRequest') {
      navigate(msg.direction);
    }
  });

  window.mdCommentsNav = { jumpTo: jumpTo };

  const initialFragment = document.body.getAttribute('data-md-nav-fragment') || '';
  const initialScroll = document.body.getAttribute('data-md-nav-scroll');
  requestAnimationFrame(function () {
    applyTarget(initialFragment, initialScroll ? Number(initialScroll) : NaN);
  });
  // The document was just rebuilt, so ask the host for the back/forward state.
  post('nav-ready');
})();
