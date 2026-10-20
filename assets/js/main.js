/* The Avant-garde Club — small, optional enhancements for the static pages. */
(() => {
  'use strict';

  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#primary-nav');
  const narrow = matchMedia('(max-width: 52rem)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  // iOS Safari needs a touch listener for reliable CSS :active feedback.
  document.addEventListener('touchstart', () => {}, { passive: true });

  // Preserve useful links into the original one-page site.
  if (document.body.dataset.page === 'home') {
    const formerSections = {
      '#beginnings': 'about/#story', '#vision': 'about/#story',
      '#community': 'about/#community', '#values': 'about/#values',
      '#team': 'about/#team', '#activities': 'activities/',
      '#careers': 'membership/#career-support', '#membership': 'membership/',
      '#conduct': 'conduct/',
    };
    const followFormerLink = () => {
      const target = formerSections[location.hash];
      if (target) location.replace(new URL(target, location.href));
    };
    followFormerLink();
    addEventListener('hashchange', followFormerLink);
  }

  // Small light fields only update while a pointer is over the actual object.
  // Decorative marks remain images, without extra buttons or keyboard stops.
  const glowResets = [];
  document.querySelectorAll('[data-glow]').forEach((element) => {
    let frame = 0;
    let pointer;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.classList.remove('is-tracking');
      ['--glow-x', '--glow-y', '--tilt-x', '--tilt-y'].forEach((name) => element.style.removeProperty(name));
    };
    element.addEventListener('pointermove', (event) => {
      if (!finePointer.matches || motion.matches || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const x = Math.max(0, Math.min(1, (pointer.x - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (pointer.y - bounds.top) / bounds.height));
        element.style.setProperty('--glow-x', `${(x * 100).toFixed(1)}%`);
        element.style.setProperty('--glow-y', `${(y * 100).toFixed(1)}%`);
        if (element.hasAttribute('data-tilt')) {
          element.classList.add('is-tracking');
          element.style.setProperty('--tilt-x', `${((.5 - y) * 7).toFixed(2)}deg`);
          element.style.setProperty('--tilt-y', `${((x - .5) * 7).toFixed(2)}deg`);
        }
      });
    }, { passive: true });
    element.addEventListener('pointerleave', reset);
    element.addEventListener('pointercancel', reset);
    glowResets.push(reset);
  });
  const resetGlows = () => glowResets.forEach((reset) => reset());
  motion.addEventListener('change', resetGlows);
  finePointer.addEventListener('change', resetGlows);
  addEventListener('blur', resetGlows);

  // Keep the page marker, hover and keyboard focus on one sliding glass surface.
  let refreshNav = () => {};
  if (nav) {
    const indicator = document.createElement('span');
    indicator.className = 'nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    nav.prepend(indicator);
    let hovered = null;
    let arrivalFrame = 0;
    const restingLink = () => nav.querySelector('a[data-section-current]')
      || nav.querySelector('a[aria-current="page"]');
    const place = (link) => {
      if (!link || narrow.matches) {
        indicator.classList.remove('is-visible');
        return;
      }
      // Reappear at the next item, without flying in from a stale position.
      if (!indicator.classList.contains('is-visible')) {
        cancelAnimationFrame(arrivalFrame);
        nav.removeAttribute('data-indicator-ready');
      }
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.height = `${link.offsetHeight}px`;
      indicator.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
      indicator.classList.add('is-visible');
      if (!nav.hasAttribute('data-indicator-ready')) {
        cancelAnimationFrame(arrivalFrame);
        arrivalFrame = requestAnimationFrame(() => {
          arrivalFrame = requestAnimationFrame(() => { nav.dataset.indicatorReady = ''; });
        });
      }
    };
    refreshNav = () => place(nav.querySelector('a:focus-visible') || hovered || restingLink());
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch' || !finePointer.matches) return;
        hovered = link;
        refreshNav();
      });
    });
    nav.addEventListener('pointerleave', () => { hovered = null; refreshNav(); });
    nav.addEventListener('focusin', refreshNav);
    nav.addEventListener('focusout', () => requestAnimationFrame(refreshNav));
    narrow.addEventListener('change', () => { hovered = null; refreshNav(); });
    if ('ResizeObserver' in window) new ResizeObserver(refreshNav).observe(nav);
    document.fonts?.ready.then(refreshNav);
    refreshNav();
  }

  // A reversible glass disclosure. Inert closes keyboard access immediately,
  // while CSS can finish the same transition in either direction.
  if (header && toggle && nav) {
    let open = false;
    let readyFrame = 0;
    const setMenu = (next, returnFocus = false) => {
      const focusInNav = nav.contains(document.activeElement);
      const focusOnToggle = document.activeElement === toggle;
      open = next && narrow.matches;
      header.classList.toggle('menu-open', open);
      nav.inert = narrow.matches && !open;
      nav.hidden = false;
      toggle.hidden = !narrow.matches;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.nav-toggle__label').textContent = open ? 'Close' : 'Menu';
      if (!open && narrow.matches && (returnFocus || focusInNav)) {
        toggle.focus({ preventScroll: true });
      }
      if (!narrow.matches && focusOnToggle) {
        (nav.querySelector('[aria-current="page"]') || nav.querySelector('a'))?.focus({ preventScroll: true });
      }
    };
    const resetMenu = () => {
      cancelAnimationFrame(readyFrame);
      root.classList.remove('nav-ready');
      setMenu(false);
      // Commit the closed layout before enabling transitions: no load flash.
      readyFrame = requestAnimationFrame(() => {
        readyFrame = requestAnimationFrame(() => root.classList.add('nav-ready'));
      });
    };
    toggle.addEventListener('click', () => setMenu(!open));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && open) setMenu(false, true);
    });
    document.addEventListener('click', (event) => {
      if (open && !header.contains(event.target)) setMenu(false);
    });
    document.addEventListener('focusin', (event) => {
      if (open && !header.contains(event.target)) setMenu(false);
    });
    narrow.addEventListener('change', resetMenu);
    addEventListener('pageshow', resetMenu);
    root.classList.add('nav-enhanced');
    resetMenu();
  }

  // Let native anchors scroll, but move keyboard reading order to their target.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  // Small, optional entrances. Elements are never hidden awaiting JavaScript.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const arriving = entries.filter((entry) => entry.isIntersecting);
      arriving.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      arriving.forEach((entry, index) => {
        if (!motion.matches) {
          entry.target.style.setProperty('--arrival-delay', `${Math.min(index, 3) * 65}ms`);
          entry.target.classList.add('has-entered');
        }
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    // Observe readable units, so a tall mobile chapter need not enter all at once.
    const entrances = [
      '.section-heading', '.editorial-grid > .section-label', '.editorial-grid > .reading-copy',
      '.editorial-grid > div > h2', '.editorial-grid > div > .lead', '.intro-bottom',
      '.plain-columns > div', '.values-list > div', '.values-section .editorial-grid > div',
      '.activity-group__intro', '.format-list article', '.person', '.connection',
      '.invite-grid', '.principle', '.page-next > div', '.contact-row > div',
    ];
    const entranceSelector = entrances.join(',');
    document.querySelectorAll(entranceSelector).forEach((el) => {
      if (!el.parentElement.closest(entranceSelector)) observer.observe(el);
    });
  }

  // The original glass navigation follows the tone of the chapter beneath it.
  // The hero has a small depth shift; normal document scrolling stays untouched.
  if (header) {
    const chapters = [...document.querySelectorAll('main > *, footer[data-theme]')];
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const capsule = header.querySelector('.header-inner');
    const hero = document.querySelector('.hero');
    const contact = document.querySelector('#contact');
    const contactLink = nav?.querySelector('a[href="#contact"]');
    const toc = [...document.querySelectorAll('.conduct-toc a[href^="#"]')].map((link) => ({
      link, section: document.getElementById(link.hash.slice(1)),
    })).filter((item) => item.section);
    let activePrinciple = null;
    let frame = 0;
    const updateTheme = () => {
      frame = 0;
      const bounds = capsule.getBoundingClientRect();
      const line = bounds.top + bounds.height / 2;
      const chapter = chapters.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= line && rect.bottom > line;
      });
      header.dataset.theme = chapter?.dataset.theme || 'light';
      const background = chapter ? getComputedStyle(chapter).backgroundColor : '';
      const colour = header.dataset.theme === 'dark' ? '#050607'
        : background && background !== 'rgba(0, 0, 0, 0)' ? background : '#f7f8f9';
      if (themeMeta && themeMeta.content !== colour) themeMeta.content = colour;
      if (hero) {
        const rect = hero.getBoundingClientRect();
        const progress = motion.matches ? 0 : Math.max(0, Math.min(1, -rect.top / rect.height));
        const value = progress.toFixed(3);
        if (hero.style.getPropertyValue('--hero-exit') !== value) hero.style.setProperty('--hero-exit', value);
      }
      if (contactLink && contact) {
        const atContact = contact.getBoundingClientRect().top < innerHeight * .45;
        if (atContact !== contactLink.hasAttribute('data-section-current')) {
          contactLink.toggleAttribute('data-section-current', atContact);
          refreshNav();
        }
      }
      if (toc.length) {
        // Match anchor landing positions, including short principles that can
        // otherwise make the following entry appear selected after a click.
        const readingLine = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 100) + 16;
        const active = [...toc].reverse().find((item) => item.section.getBoundingClientRect().top <= readingLine) || toc[0];
        if (active !== activePrinciple) {
          activePrinciple?.link.removeAttribute('aria-current');
          active.link.setAttribute('aria-current', 'location');
          activePrinciple = active;
        }
      }
    };
    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateTheme);
    };
    addEventListener('scroll', requestUpdate, { passive: true });
    addEventListener('resize', requestUpdate, { passive: true });
    addEventListener('pageshow', requestUpdate);
    motion.addEventListener('change', requestUpdate);
    updateTheme();
  }
  root.classList.add('is-ready');
})();
