/* Outline drawer for the standalone comment preview panel. */
(function () {
  const model = window.mdCommentsNavModel;
  const vscode = window.__mdCommentsVsCodeApi;
  const layout = document.getElementById('md-comments-layout');
  const docEl = document.querySelector('.md-comments-document');
  const navbar = document.getElementById('md-comments-navbar');
  if (!model || !vscode || !layout || !docEl || !navbar) {
    return;
  }

  const DEPTHS = [
    { value: 2, label: 'H2' },
    { value: 3, label: 'H3' },
    { value: 4, label: 'H4' },
    { value: 6, label: 'All' },
  ];
  const saved = vscode.getState() || {};
  let open = saved.outlineOpen === true;
  let depth = typeof saved.outlineDepth === 'number' ? saved.outlineDepth : 3;

  function saveState() {
    vscode.setState(
      Object.assign({}, vscode.getState() || {}, { outlineOpen: open, outlineDepth: depth })
    );
  }

  const headingEls = Array.prototype.slice
    .call(docEl.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .filter(function (h) {
      return !!h.id;
    });
  const items = headingEls.map(function (h, i) {
    return {
      index: i,
      level: Number(h.tagName.charAt(1)),
      id: h.id,
      text: (h.textContent || '').trim(),
      openThreads: 0,
    };
  });

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'md-comments-nav-btn md-comments-outline-toggle';
  toggle.title = 'Outline (O)';
  toggle.setAttribute('aria-label', 'Toggle outline');
  toggle.textContent = '☰';
  toggle.disabled = items.length === 0;
  navbar.insertBefore(toggle, navbar.querySelector('.md-comments-nav-title'));

  const aside = document.createElement('aside');
  aside.id = 'md-comments-outline';
  aside.className = 'md-comments-outline';
  aside.setAttribute('aria-label', 'Outline');
  const header = document.createElement('header');
  header.className = 'md-comments-outline-header';
  const heading = document.createElement('span');
  heading.className = 'md-comments-outline-title';
  heading.textContent = 'Outline';
  const depthSelect = document.createElement('select');
  depthSelect.className = 'md-comments-outline-depth';
  depthSelect.setAttribute('aria-label', 'Outline depth');
  DEPTHS.forEach(function (d) {
    const option = document.createElement('option');
    option.value = String(d.value);
    option.textContent = d.label;
    depthSelect.appendChild(option);
  });
  depthSelect.value = String(depth);
  header.append(heading, depthSelect);
  const filter = document.createElement('input');
  filter.type = 'search';
  filter.className = 'md-comments-outline-filter';
  filter.placeholder = 'Filter headings';
  filter.setAttribute('aria-label', 'Filter headings');
  const list = document.createElement('ol');
  list.className = 'md-comments-outline-list';
  aside.append(header, filter, list);
  layout.appendChild(aside);

  function activeIndex() {
    const tops = headingEls.map(function (h) {
      return h.getBoundingClientRect().top + window.scrollY;
    });
    return model.activeHeadingIndex(tops, window.scrollY, navbar.offsetHeight + 16);
  }

  function highlightActive() {
    const previous = list.querySelector('.is-active');
    if (previous) {
      previous.classList.remove('is-active');
    }
    const li = list.querySelector('[data-index="' + activeIndex() + '"]');
    if (!li) {
      return;
    }
    li.classList.add('is-active');
    // Keep the active entry visible without scrolling the document itself.
    const top = li.offsetTop;
    const bottom = top + li.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }

  function render() {
    list.textContent = '';
    model.visibleOutline(items, depth, filter.value).forEach(function (item) {
      const li = document.createElement('li');
      li.className = 'md-comments-outline-item';
      li.setAttribute('data-index', String(item.index));
      li.setAttribute('data-level', String(item.level));
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'md-comments-outline-link';
      btn.style.paddingLeft = 8 + (item.level - 1) * 12 + 'px';
      btn.title = item.text;
      const label = document.createElement('span');
      label.className = 'md-comments-outline-text';
      label.textContent = item.text;
      btn.appendChild(label);
      if (item.openThreads > 0) {
        const count = document.createElement('span');
        count.className = 'md-comments-outline-count';
        count.textContent = String(item.openThreads);
        count.title =
          item.openThreads + (item.openThreads === 1 ? ' open thread' : ' open threads');
        btn.appendChild(count);
      }
      btn.addEventListener('click', function () {
        if (window.mdCommentsNav) {
          window.mdCommentsNav.jumpTo(item.id);
        }
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    highlightActive();
  }

  function anchorElementFor(card) {
    const id = card.getAttribute('data-md-comment-id') || '';
    if (id) {
      const escaped = window.CSS && CSS.escape ? CSS.escape(id) : id;
      const marked = docEl.querySelector('[data-md-comment-id~="' + escaped + '"]');
      if (marked) {
        return marked;
      }
    }
    const index = card.getAttribute('data-md-paragraph-index');
    return index === null ? null : docEl.querySelector('[data-md-paragraph-index="' + index + '"]');
  }

  function sectionOf(el) {
    let section = -1;
    for (let i = 0; i < headingEls.length; i++) {
      const h = headingEls[i];
      if (h === el || h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        section = i;
      } else {
        break;
      }
    }
    return section;
  }

  function updateCounts() {
    const sections = [];
    document
      .querySelectorAll('#inline-threads .md-comments-card[data-md-type="inline"]')
      .forEach(function (card) {
        if (
          card.getAttribute('data-md-resolved') === 'true' ||
          card.querySelector('.md-comments-badge-orphan')
        ) {
          return;
        }
        const el = anchorElementFor(card);
        if (el) {
          sections.push(sectionOf(el));
        }
      });
    const counts = model.countOpenThreadsBySection(
      items.map(function (item) {
        return item.level;
      }),
      sections
    );
    items.forEach(function (item, i) {
      item.openThreads = counts[i];
    });
    render();
  }

  function setOpen(value) {
    open = value;
    layout.classList.toggle('md-comments-outline-open', open);
    toggle.setAttribute('aria-pressed', String(open));
    saveState();
    if (open) {
      highlightActive();
    }
  }

  toggle.addEventListener('click', function () {
    setOpen(!open);
  });
  depthSelect.addEventListener('change', function () {
    depth = Number(depthSelect.value);
    saveState();
    render();
  });
  filter.addEventListener('input', render);
  filter.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      filter.value = '';
      render();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'o' || e.metaKey || e.ctrlKey || e.altKey || items.length === 0) {
      return;
    }
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
      return;
    }
    e.preventDefault();
    setOpen(!open);
  });

  let scrollPending = false;
  window.addEventListener(
    'scroll',
    function () {
      if (scrollPending) {
        return;
      }
      scrollPending = true;
      requestAnimationFrame(function () {
        scrollPending = false;
        highlightActive();
      });
    },
    { passive: true }
  );

  // Comment cards arrive late (initial fetch, refreshes, optimistic posts), so recount on change.
  const sidebar = document.getElementById('md-comments-sidebar');
  if (sidebar) {
    let countTimer = null;
    new MutationObserver(function () {
      clearTimeout(countTimer);
      countTimer = setTimeout(updateCounts, 250);
    }).observe(sidebar, { childList: true, subtree: true });
  }

  setOpen(open);
  updateCounts();
})();
