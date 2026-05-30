(() => {
  // ---------- Year ----------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Mobile nav ----------
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  });

  // ---------- Active section highlight ----------
  const sections = document.querySelectorAll('main .section');
  const navLinks = document.querySelectorAll('.nav-link');
  const setActive = id => {
    navLinks.forEach(l => l.classList.toggle('is-active', l.dataset.section === id));
  };
  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) setActive(e.target.id);
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach(s => sectionObserver.observe(s));

  // ---------- Reveal on scroll ----------
  const revealEls = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObserver.observe(el));

  // ---------- Neural-network background ----------
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas?.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (canvas && ctx && !reduceMotion) {
    let w, h, dpr, nodes;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth = window.innerWidth;
      h = canvas.clientHeight = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = w * h;
      const count = Math.min(110, Math.max(36, Math.floor(area / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.6
      }));
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener('mouseleave', () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });

    const LINK = 130;
    const MOUSE_LINK = 170;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Update + draw nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 220, 255, 0.55)';
        ctx.fill();
      }

      // Node-to-node links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const t = 1 - Math.sqrt(d2) / LINK;
            ctx.strokeStyle = `rgba(124, 200, 255, ${t * 0.18})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Mouse-to-node links (interactive accent)
      for (const n of nodes) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_LINK * MOUSE_LINK) {
          const d = Math.sqrt(d2);
          const t = 1 - d / MOUSE_LINK;
          ctx.strokeStyle = `rgba(124, 77, 255, ${t * 0.45})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(mouse.x, mouse.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();

          // Gentle attraction
          n.vx += (dx / d) * -0.0008 * t;
          n.vy += (dy / d) * -0.0008 * t;
        }
        // Damping
        n.vx *= 0.995;
        n.vy *= 0.995;
        // Min velocity so they don't freeze
        const sp = Math.hypot(n.vx, n.vy);
        if (sp < 0.05) {
          n.vx += (Math.random() - 0.5) * 0.02;
          n.vy += (Math.random() - 0.5) * 0.02;
        }
      }

      requestAnimationFrame(draw);
    };

    resize();
    requestAnimationFrame(draw);
  }

  // ---------- Contact form ----------
  const form = document.getElementById('contact-form');
  const status = form?.querySelector('.form-status');

  const setStatus = (msg, kind) => {
    if (!status) return;
    status.textContent = msg;
    status.classList.remove('is-success', 'is-error');
    if (kind) status.classList.add(`is-${kind}`);
  };

  const markField = (input, valid) => {
    input.closest('.field')?.classList.toggle('invalid', !valid);
  };

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    setStatus('', null);

    const name = form.name;
    const email = form.email;
    const message = form.message;

    const validName = name.value.trim().length > 1;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    const validMsg = message.value.trim().length > 4;

    markField(name, validName);
    markField(email, validEmail);
    markField(message, validMsg);

    if (!(validName && validEmail && validMsg)) {
      setStatus('Please fill in your name, a valid email, and a short message.', 'error');
      return;
    }

    // Honeypot
    if (form._gotcha.value) return;

    // If Formspree isn't configured, fall back to a friendly message
    if (form.action.includes('YOUR_FORM_ID')) {
      setStatus(
        'Form not yet connected — set up Formspree (see README) to enable delivery.',
        'error'
      );
      return;
    }

    form.classList.add('is-submitting');
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        form.reset();
        setStatus("Thanks — your message is on its way. I'll be in touch soon.", 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus(data?.errors?.[0]?.message || 'Something went wrong. Please email me directly.', 'error');
      }
    } catch (err) {
      setStatus('Network error — please try again, or email me directly.', 'error');
    } finally {
      form.classList.remove('is-submitting');
    }
  });
})();
