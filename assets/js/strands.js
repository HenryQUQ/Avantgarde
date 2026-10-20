/* The original titanium light field, isolated from the former single-page UI. */
(() => {
  'use strict';
  const canvas = document.querySelector('canvas[data-ribbons="hero"]');
  if (!canvas || !canvas.getContext('2d')) return;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const TAU = Math.PI * 2;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let reduceMotion = motionQuery.matches;
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

      if (preset.interactive) {
        const host = canvas.parentElement;
        host.addEventListener('pointermove', (event) => {
          if (!finePointer.matches || reduceMotion || event.pointerType === 'touch') return;
          const rect = canvas.getBoundingClientRect();
          this.target.x = event.clientX - rect.left;
          this.target.y = event.clientY - rect.top;
          if (this.pull.value < 0.01) {
            this.mx.value = this.target.x;
            this.my.value = this.target.y;
          }
          this.target.pull = 1;
        }, { passive: true });
        const release = () => { this.target.pull = 0; };
        host.addEventListener('pointerleave', release);
        host.addEventListener('pointercancel', release);
        finePointer.addEventListener('change', release);
        addEventListener('blur', release);
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

  const field = new LightStrands(canvas, RIBBONS.hero);
  const toggle = document.querySelector('.motion-toggle');
  let paused = false;
  // Remember an explicit pause when visiting another page and coming back.
  try { paused = sessionStorage.getItem('av-background-paused') === 'true'; } catch {}
  if (paused) field.age = 10;
  field.visible = true;
  const sync = () => {
    if (reduceMotion || paused || document.hidden || !field.visible) field.stop();
    else field.start();
    if (reduceMotion) field.draw();
    if (toggle) {
      toggle.hidden = reduceMotion;
      toggle.classList.toggle('is-paused', paused);
      toggle.setAttribute('aria-label', paused ? 'Play background animation' : 'Pause background animation');
    }
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      field.visible = entry.isIntersecting;
      sync();
    });
    observer.observe(canvas);
  }
  toggle?.addEventListener('click', () => {
    paused = !paused;
    try { sessionStorage.setItem('av-background-paused', String(paused)); } catch {}
    sync();
  });
  motionQuery.addEventListener('change', () => {
    reduceMotion = motionQuery.matches;
    field.target.pull = 0;
    field.pull.value = 0;
    field.pull.velocity = 0;
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  addEventListener('pagehide', () => field.stop());
  addEventListener('pageshow', sync);
  field.draw();
  sync();
})();
