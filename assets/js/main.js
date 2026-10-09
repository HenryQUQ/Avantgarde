/* ==========================================================================
   The Avant-garde Club — interaction layer
   No dependencies. Everything here is progressive enhancement: without it
   the page is complete, static and readable.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('is-ready');

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const TAU = Math.PI * 2;

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let reduceMotion = motionQuery.matches;

  // iOS Safari only applies :active styles once a touch listener exists, and
  // press feedback has to land on touch-down to feel direct.
  document.addEventListener('touchstart', () => {}, { passive: true });

  /* Springs
     Apple's designer-facing parameters: `response` (seconds to reach the
     target) and `damping` (ratio; 1 = critically damped, no overshoot),
     converted to stiffness and damping with unit mass as SwiftUI does.
     Retargeting keeps the current value and velocity, so motion can be
     reversed mid-flight without a jump.
     ------------------------------------------------------------------------ */

  const coefficients = (response, damping) => ({
    stiffness: (TAU / response) ** 2,
    friction: (4 * Math.PI * damping) / response,
  });

  // Advance a {value, velocity} pair towards `target` by `dt` seconds.
  function integrate(state, target, dt, { stiffness, friction }) {
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      const force = -stiffness * (state.value - target) - friction * state.velocity;
      state.velocity += force * h;
      state.value += state.velocity * h;
      dt -= h;
    }
  }

  class Spring {
    constructor({ value = 0, response = 0.4, damping = 1, onUpdate, onRest }) {
      this.value = value;
      this.velocity = 0;
      this.target = value;
      this.onUpdate = onUpdate;
      this.onRest = onRest;
      this.frame = 0;
      this.last = 0;
      this.tick = this.tick.bind(this);
      this.configure(response, damping);
    }

    configure(response, damping = 1) {
      this.k = coefficients(response, damping);
    }

    to(target) {
      this.target = target;
      if (!this.frame) {
        this.last = 0;
        this.frame = requestAnimationFrame(this.tick);
      }
    }

    set(value) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.value = this.target = value;
      this.velocity = 0;
      this.onUpdate?.(value);
      this.onRest?.(value);
    }

    tick(now) {
      // Clamp long gaps (background tabs) so the spring never leaps.
      const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60;
      this.last = now;
      integrate(this, this.target, dt, this.k);

      if (Math.abs(this.velocity) < 1e-3 && Math.abs(this.value - this.target) < 1e-3) {
        this.frame = 0;
        this.value = this.target;
        this.velocity = 0;
        this.onUpdate?.(this.value);
        this.onRest?.(this.value);
        return;
      }

      this.onUpdate?.(this.value);
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  /* Light strands
     Bundles of fine silver fibres that twist as they travel, after the
     titanium-and-light imagery in the club deck. Strands converge where the
     ribbon turns edge-on, so additive blending makes those crossings glow.
     Small pulses run along them like signal through fibre. The pointer bends
     the field gently, smoothed by independent X and Y springs.
     ------------------------------------------------------------------------ */

  const NO_JITTER = { phase: 0, lift: 0, bright: 1 };

  const RIBBONS = {
    hero: {
      pulses: 14,
      interactive: true,
      ribbons: [
        { x0: -0.08, x1: 1.08, y0: 0.8, y1: 0.24, amp: 0.1, freq: 0.85, speed: 0.13, phase: 0.4, twist: 1.25, spin: 0.2, width: 0.17, strands: 52, alpha: 0.92, line: 0.9, color: 'rgb(222, 230, 242)' },
        { x0: -0.08, x1: 1.08, y0: 0.16, y1: 0.88, amp: 0.07, freq: 1.15, speed: -0.1, phase: 2.2, twist: 0.95, spin: -0.16, width: 0.11, strands: 36, alpha: 0.6, line: 0.8, color: 'rgb(190, 206, 232)' },
      ],
    },
    closing: {
      pulses: 8,
      interactive: true,
      ribbons: [
        { x0: -0.08, x1: 1.08, y0: 0.94, y1: 0.7, amp: 0.07, freq: 0.9, speed: 0.1, phase: 1.1, twist: 1.1, spin: 0.16, width: 0.13, strands: 44, alpha: 0.75, line: 0.85, color: 'rgb(222, 230, 242)' },
      ],
    },
  };

  class LightStrands {
    constructor(canvas, preset) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.preset = preset;
      this.ribbons = preset.ribbons;
      this.segments = 80;
      this.xs = new Float32Array(this.segments + 1);
      this.ys = new Float32Array(this.segments + 1);
      this.zs = new Float32Array(this.segments + 1);
      this.time = 3 + Math.random() * 3;
      this.age = 0;
      this.density = 1;
      this.slowFrames = 0;
      this.running = false;
      this.frame = 0;
      this.last = 0;
      this.pulses = Array.from({ length: preset.pulses }, (_, i) => this.spawn(i / preset.pulses));

      // Each fibre gets its own small offsets so the bundle reads as loose
      // strands of light rather than a rigid sheet.
      let seed = 7;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const ribbon of this.ribbons) {
        ribbon.jitter = Array.from({ length: ribbon.strands }, () => ({
          phase: (random() - 0.5) * 0.9,
          lift: (random() - 0.5) * 0.035,
          bright: 0.55 + random() * 0.45,
        }));
      }

      // Bloom: a half-resolution copy of the field, blurred by the compositor,
      // sits underneath so the strands glow like light trails.
      this.glow = document.createElement('canvas');
      this.glow.className = `${canvas.className} strands-glow`;
      this.glow.setAttribute('aria-hidden', 'true');
      canvas.before(this.glow);
      this.glowCtx = this.glow.getContext('2d');

      // Pointer field: X, Y and strength each ride their own spring.
      this.mx = { value: 0, velocity: 0 };
      this.my = { value: 0, velocity: 0 };
      this.pull = { value: 0, velocity: 0 };
      this.target = { x: 0, y: 0, pull: 0 };
      this.followK = coefficients(0.9, 1);
      this.pullK = coefficients(0.6, 1);

      this.tick = this.tick.bind(this);
      this.resize();
      new ResizeObserver(() => { this.resize(); if (!this.running) this.draw(); }).observe(canvas);

      if (preset.interactive && finePointer.matches) {
        const host = canvas.parentElement;
        host.addEventListener('pointermove', (event) => {
          const rect = canvas.getBoundingClientRect();
          this.target.x = event.clientX - rect.left;
          this.target.y = event.clientY - rect.top;
          if (this.pull.value < 0.01) {
            this.mx.value = this.target.x;
            this.my.value = this.target.y;
          }
          this.target.pull = 1;
        });
        host.addEventListener('pointerleave', () => { this.target.pull = 0; });
      }
    }

    spawn(u = -0.15) {
      return {
        ribbon: Math.floor(Math.random() * this.ribbons.length),
        o: Math.random() * 1.8 - 0.9,
        u,
        speed: 0.05 + Math.random() * 0.06,
        length: 0.05 + Math.random() * 0.05,
      };
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, this.density < 0.8 ? 1 : 1.75);
      this.width = rect.width;
      this.height = rect.height;
      this.ratio = ratio;
      this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
      this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
      this.glow.width = Math.max(1, Math.round(rect.width / 2));
      this.glow.height = Math.max(1, Math.round(rect.height / 2));
      this.compact = rect.width < 720;
    }

    start() {
      if (this.running || reduceMotion) return;
      this.running = true;
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.frame);
    }

    tick(now) {
      if (!this.running) return;
      const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 20) : 1 / 60;
      this.last = now;
      this.time += dt;
      this.age += dt;

      integrate(this.mx, this.target.x, dt, this.followK);
      integrate(this.my, this.target.y, dt, this.followK);
      integrate(this.pull, this.target.pull, dt, this.pullK);

      for (const pulse of this.pulses) {
        pulse.u += pulse.speed * dt;
        if (pulse.u - pulse.length > 1.05) Object.assign(pulse, this.spawn());
      }

      this.draw();

      // Adaptive quality: thin the field on devices that cannot keep up.
      this.slowFrames = dt > 0.026 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 40 && this.density > 0.45) {
        this.density *= 0.75;
        this.slowFrames = 0;
        this.resize();
      }

      this.frame = requestAnimationFrame(this.tick);
    }

    // Draw-in on first appearance: the strands extend across the screen on a
    // critically damped curve.
    reveal() {
      if (reduceMotion) return 1;
      const s = Math.max(0, this.age - 0.15) * (TAU / 1.5);
      return clamp(1 - (1 + s) * Math.exp(-s));
    }

    // Writes the position of strand `o` at parameter `u` into the scratch arrays.
    point(ribbon, o, u, index, jitter = NO_JITTER) {
      const { width: w, height: h, time } = this;
      const x = (ribbon.x0 + (ribbon.x1 - ribbon.x0) * u) * w;
      const wave = Math.sin(u * ribbon.freq * TAU + time * ribbon.speed + ribbon.phase + jitter.phase * 0.35);
      const centre = (ribbon.y0 + (ribbon.y1 - ribbon.y0) * u + ribbon.amp * wave + jitter.lift * Math.sin(Math.PI * u)) * h;
      const theta = u * ribbon.twist * TAU + time * ribbon.spin + ribbon.phase + jitter.phase;
      const spread = ribbon.width * h * (0.42 + 0.58 * Math.sin(Math.PI * u));
      let y = centre + o * spread * Math.cos(theta);

      const pull = this.pull.value;
      if (pull > 0.002) {
        const dx = x - this.mx.value;
        const dy = y - this.my.value;
        const sigma = 0.2 * Math.max(w, h);
        y += (this.my.value - y) * 0.32 * pull * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      }

      this.xs[index] = x;
      this.ys[index] = y;
      this.zs[index] = o * Math.sin(theta);
    }

    draw() {
      const { ctx, ratio } = this;
      const reveal = this.reveal();
      const segments = Math.round(this.segments * (this.compact ? 0.7 : 1));
      const chunk = 8;

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const ribbon of this.ribbons) {
        const strands = Math.max(8, Math.round(ribbon.strands * this.density * (this.compact ? 0.6 : 1)));
        ctx.strokeStyle = ribbon.color;
        ctx.lineWidth = ribbon.line;
        const visible = Math.max(1, Math.floor(segments * reveal));

        for (let i = 0; i < strands; i++) {
          const o = (i / (strands - 1)) * 2 - 1;
          const jitter = ribbon.jitter[Math.floor((i / strands) * ribbon.jitter.length)];
          const edge = (1 - 0.6 * o * o) * jitter.bright;
          for (let j = 0; j <= visible; j++) this.point(ribbon, o, j / segments, j, jitter);

          for (let a = 0; a < visible; a += chunk) {
            const b = Math.min(visible, a + chunk);
            const depth = (this.zs[(a + b) >> 1] + 1) / 2;
            ctx.globalAlpha = ribbon.alpha * edge * (0.1 + 0.9 * depth * depth);
            ctx.beginPath();
            ctx.moveTo(this.xs[a], this.ys[a]);
            for (let j = a + 1; j <= b; j++) ctx.lineTo(this.xs[j], this.ys[j]);
            ctx.stroke();
          }
        }
      }

      // Signal pulses: short comets with a bright head.
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 1.4;
      for (const pulse of this.pulses) {
        const ribbon = this.ribbons[pulse.ribbon];
        if (pulse.u > reveal) continue;
        const steps = 6;
        for (let k = 0; k <= steps; k++) {
          this.point(ribbon, pulse.o, pulse.u - pulse.length * (1 - k / steps), k);
        }
        const depth = (this.zs[steps] + 1) / 2;
        for (let k = 0; k < steps; k++) {
          ctx.globalAlpha = ((k + 1) / steps) ** 2 * (0.25 + 0.75 * depth);
          ctx.beginPath();
          ctx.moveTo(this.xs[k], this.ys[k]);
          ctx.lineTo(this.xs[k + 1], this.ys[k + 1]);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.6 + 0.4 * depth;
        ctx.beginPath();
        ctx.arc(this.xs[steps], this.ys[steps], 1.6, 0, TAU);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      const glow = this.glowCtx;
      glow.clearRect(0, 0, this.glow.width, this.glow.height);
      glow.drawImage(this.canvas, 0, 0, this.glow.width, this.glow.height);

      if (!this.live && reveal > 0) {
        this.live = true;
        this.canvas.classList.add('is-live');
        this.glow.classList.add('is-live');
      }
    }
  }

  const strandFields = $$('canvas[data-ribbons]').map((canvas) => new LightStrands(canvas, RIBBONS[canvas.dataset.ribbons]));
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const field = strandFields.find((f) => f.canvas === entry.target);
        if (!field) continue;
        field.visible = entry.isIntersecting;
        if (entry.isIntersecting && !document.hidden) field.start();
        else field.stop();
      }
    });
    strandFields.forEach((field) => { field.draw(); watcher.observe(field.canvas); });
  }
  document.addEventListener('visibilitychange', () => {
    for (const field of strandFields) {
      if (document.hidden) field.stop();
      else if (field.visible) field.start();
    }
  });

  /* Reveal on scroll
     ------------------------------------------------------------------------ */

  const revealables = $$('.reveal');

  // The opening view arrives as one composed moment.
  const opening = revealables.filter((el) => el.closest('.hero'));
  opening.forEach((el, i) => el.style.setProperty('--d', i));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    opening.forEach((el) => el.classList.add('is-in'));
  }));

  // Everything else staggers only with whatever enters alongside it, so an
  // element scrolled into view on its own never waits for siblings.
  const later = revealables.filter((el) => !opening.includes(el));
  if ('IntersectionObserver' in window) {
    const revealer = new IntersectionObserver((entries) => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.style.setProperty('--d', Math.min(order++, 4));
        entry.target.classList.add('is-in');
        revealer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    later.forEach((el) => revealer.observe(el));
  } else {
    later.forEach((el) => el.classList.add('is-in'));
  }

  /* Scroll scenes
     Each scene maps scroll position to a progress value; CSS derives every
     transform from that one number. Scrolling back simply plays it backwards.
     ------------------------------------------------------------------------ */

  const scenes = [];
  const addScene = (el, mode, apply) => { if (el) scenes.push({ el, mode, apply, top: 0, height: 0, p: -1 }); };
  const setP = (el, name = '--p') => (p) => el.style.setProperty(name, p.toFixed(4));

  const hero = $('.hero');
  addScene(hero, 'exit', setP(hero, '--exit'));

  // Manifesto: one word lights up after another.
  const manifesto = $('[data-manifesto]');
  if (manifesto) {
    const text = $('.manifesto__text', manifesto);
    const words = text.textContent.trim().split(/\s+/);
    text.textContent = '';
    const spans = words.map((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      text.append(span, i < words.length - 1 ? ' ' : '');
      return span;
    });
    addScene(manifesto, 'sticky', (p) => {
      const lit = clamp((p - 0.1) / 0.62) * (spans.length + 2);
      spans.forEach((span, i) => {
        const opacity = (0.16 + 0.84 * clamp(lit - i)).toFixed(2);
        if (span.dataset.o !== opacity) {
          span.style.opacity = opacity;
          span.dataset.o = opacity;
        }
      });
    });
  }

  const year = $('[data-year]');
  addScene(year, 'view', setP(year));

  const vision = $('.vision');
  addScene(vision, 'sticky', setP($('.vision__sticky')));

  const careers = $('.careers');
  addScene(careers, 'view', setP($('.careers__media')));

  const seal = $('[data-seal]');
  addScene(seal, 'view', setP(seal));

  const resetScenes = () => {
    for (const scene of scenes) scene.p = -1;
    hero?.style.removeProperty('--exit');
    [year, $('.vision__sticky'), $('.careers__media'), seal].forEach((el) => el?.style.removeProperty('--p'));
    $$('.manifesto__text .word').forEach((span) => { span.style.removeProperty('opacity'); delete span.dataset.o; });
  };

  function progressOf(scene, y, vh) {
    if (scene.mode === 'sticky') return clamp((y - scene.top) / Math.max(1, scene.height - vh));
    if (scene.mode === 'view') return clamp((y + vh - scene.top) / (vh + scene.height));
    return clamp(y / (scene.height * 0.85));
  }

  /* Navigation: adaptive glass, wayfinding, gliding indicator
     ------------------------------------------------------------------------ */

  const nav = $('[data-nav]');
  const capsule = $('.nav__capsule', nav);
  const themeColor = $('meta[name="theme-color"]');
  const themed = $$('main > [data-theme], body > footer[data-theme]');
  const barLinks = $$('.nav__links a');
  const allLinks = $$('.nav__links a, .menu__panel a');
  const linked = [...new Set(barLinks.map((a) => a.hash))].map((hash) => $(hash)).filter(Boolean);
  const pill = $('.nav__pill');

  let bands = [];
  let anchors = [];
  let probeOffset = 38;
  let activeId = null;
  let currentTint = '';
  let frame = 0;

  const pageTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  const renderPill = () => {
    pill.style.transform = `translateX(${pillX.value.toFixed(2)}px)`;
    pill.style.width = `${Math.max(0, pillW.value).toFixed(2)}px`;
    pill.style.opacity = clamp(pillO.value).toFixed(3);
  };
  const pillX = new Spring({ response: 0.42, onUpdate: renderPill });
  const pillW = new Spring({ response: 0.42, onUpdate: renderPill });
  const pillO = new Spring({ response: 0.3, onUpdate: renderPill });

  function movePill(link) {
    if (!pill) return;
    if (!link || !link.offsetParent) { pillO.to(0); return; }
    const x = link.offsetLeft;
    const w = link.offsetWidth;
    // Appear where the link is, rather than sliding in from somewhere stale.
    if (pillO.value < 0.02 || reduceMotion) { pillX.set(x); pillW.set(w); }
    pillX.to(x);
    pillW.to(w);
    if (reduceMotion) pillO.set(1); else pillO.to(1);
  }

  function measure() {
    const capsuleRect = capsule.getBoundingClientRect();
    probeOffset = capsuleRect.top + capsuleRect.height / 2;
    bands = themed.map((el) => ({
      top: pageTop(el),
      bottom: pageTop(el) + el.offsetHeight,
      theme: el.dataset.theme,
      tint: getComputedStyle(el).backgroundColor,
    }));
    anchors = linked.map((el) => ({ id: el.id, top: pageTop(el), bottom: pageTop(el) + el.offsetHeight }));
    for (const scene of scenes) {
      scene.top = pageTop(scene.el);
      scene.height = scene.el.offsetHeight;
      scene.p = -1;
    }
  }

  function update() {
    frame = 0;
    const y = window.scrollY;
    const vh = window.innerHeight;

    // Glass tint follows whatever is travelling under the capsule.
    const probe = y + probeOffset;
    const band = bands.find((b) => probe >= b.top && probe < b.bottom);
    if (band) {
      if (nav.dataset.theme !== band.theme) nav.dataset.theme = band.theme;
      if (themeColor && band.tint !== currentTint && !band.tint.includes('0, 0, 0, 0')) {
        themeColor.content = band.tint;
        currentTint = band.tint;
      }
    }

    // Wayfinding: the section that owns the upper part of the viewport.
    const line = y + vh * 0.4;
    const current = anchors.find((a) => line >= a.top && line < a.bottom);
    const id = current ? current.id : '';
    if (id !== activeId) {
      activeId = id;
      for (const link of allLinks) {
        if (link.hash === `#${id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }
      movePill(barLinks.find((link) => link.hash === `#${id}`));
    }

    if (reduceMotion) return;
    for (const scene of scenes) {
      const near = y + vh * 1.25 > scene.top && y - vh * 0.25 < scene.top + scene.height;
      if (!near) continue;
      const p = progressOf(scene, y, vh);
      if (Math.abs(p - scene.p) > 1e-4) {
        scene.p = p;
        scene.apply(p);
      }
    }
  }

  const requestUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
  const remeasure = () => { measure(); requestUpdate(); };

  measure();
  update();
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', remeasure);
  addEventListener('load', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

  motionQuery.addEventListener?.('change', (event) => {
    reduceMotion = event.matches;
    if (reduceMotion) {
      resetScenes();
      strandFields.forEach((field) => { field.stop(); field.draw(); });
    } else {
      strandFields.forEach((field) => { if (field.visible) field.start(); });
    }
    remeasure();
  });

  /* Menu (narrow screens)
     A glass sheet grows out of the button and returns into it. One spring
     drives the sheet, the item stagger and the icon, so a second tap simply
     reverses from wherever it is.
     ------------------------------------------------------------------------ */

  const toggle = $('.nav__toggle', nav);
  const menu = $('#menu');
  const outside = [$('#main'), $('body > footer')];
  let menuOpen = false;

  const menuSpring = new Spring({
    response: 0.4,
    onUpdate: (p) => {
      const value = clamp(p).toFixed(4);
      menu.style.setProperty('--p', value);
      toggle.style.setProperty('--p', value);
    },
    onRest: (p) => { if (p === 0) menu.hidden = true; },
  });

  function setMenu(open, { instant = false } = {}) {
    if (open === menuOpen) return;
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
    outside.forEach((el) => { if (el) el.inert = open; });
    if (open) menu.hidden = false;
    menuSpring.configure(reduceMotion ? 0.2 : 0.4);
    if (instant) menuSpring.set(open ? 1 : 0);
    else menuSpring.to(open ? 1 : 0);
  }

  toggle.addEventListener('click', () => setMenu(!menuOpen));
  menu.addEventListener('click', (event) => {
    // Release the scroll lock before the browser follows the link.
    if (event.target.closest('a') || event.target.closest('[data-menu-close]')) setMenu(false);
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) {
      setMenu(false);
      toggle.focus();
    }
  });
  matchMedia('(min-width: 64em)').addEventListener?.('change', (event) => {
    if (event.matches) setMenu(false, { instant: true });
    remeasure();
  });

  /* Spotlight: one light source shared by a grid of cards
     ------------------------------------------------------------------------ */

  if (finePointer.matches) {
    for (const grid of $$('[data-spotlight]')) {
      const cards = $$('.spot-card', grid);
      let pending = null;
      let raf = 0;
      grid.addEventListener('pointermove', (event) => {
        pending = event;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          for (const card of cards) {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${(pending.clientX - rect.left).toFixed(1)}px`);
            card.style.setProperty('--my', `${(pending.clientY - rect.top).toFixed(1)}px`);
          }
        });
      });
      grid.addEventListener('pointerenter', () => cards.forEach((card) => card.style.setProperty('--spot', '1')));
      grid.addEventListener('pointerleave', () => cards.forEach((card) => card.style.setProperty('--spot', '0')));
    }
  }

  /* Founding team: tvOS-style parallax tilt with a specular glare
     ------------------------------------------------------------------------ */

  if (finePointer.matches) {
    for (const card of $$('.person')) {
      let gx = 50;
      let gy = 0;
      const render = () => {
        card.style.setProperty('--rx', `${rx.value.toFixed(2)}deg`);
        card.style.setProperty('--ry', `${ry.value.toFixed(2)}deg`);
        card.style.setProperty('--go', clamp(glare.value).toFixed(3));
        card.style.setProperty('--gx', `${gx.toFixed(1)}%`);
        card.style.setProperty('--gy', `${gy.toFixed(1)}%`);
      };
      const rx = new Spring({ response: 0.5, onUpdate: render });
      const ry = new Spring({ response: 0.5, onUpdate: render });
      const glare = new Spring({ response: 0.4, onUpdate: render });

      card.addEventListener('pointermove', (event) => {
        if (reduceMotion) return;
        const rect = card.getBoundingClientRect();
        const nx = clamp((event.clientX - rect.left) / rect.width);
        const ny = clamp((event.clientY - rect.top) / rect.height);
        gx = nx * 100;
        gy = ny * 100;
        ry.to((nx - 0.5) * 12);
        rx.to((0.5 - ny) * 10);
        glare.to(0.6);
      });
      card.addEventListener('pointerleave', () => {
        rx.to(0);
        ry.to(0);
        glare.to(0);
      });
    }
  }

  /* Video wall: change content like a signage playlist while on screen
     ------------------------------------------------------------------------ */

  const walls = $$('.wall');
  if (walls.length && 'IntersectionObserver' in window) {
    const timers = new Map();
    const schedule = (wall) => {
      timers.set(wall, setTimeout(() => {
        if (!document.hidden && !reduceMotion) wall.classList.toggle('is-alt');
        schedule(wall);
      }, 5200));
    };
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        clearTimeout(timers.get(target));
        if (isIntersecting) schedule(target);
      }
    }, { threshold: 0.4 });
    walls.forEach((wall) => observer.observe(wall));
  }
})();
