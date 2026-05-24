document.addEventListener('DOMContentLoaded', () => {
  // ─── Theme Toggle ────────────────────────────────────
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') body.classList.add('light');

  themeToggle.addEventListener('click', () => {
    body.classList.toggle('light');
    localStorage.setItem('theme', body.classList.contains('light') ? 'light' : 'dark');
    themeToggle.innerHTML = body.classList.contains('light')
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  });

  // ─── Toast Notification System ───────────────────────
  const toastContainer = document.getElementById('toastContainer');

  function showToast(message) {
    if (!toastContainer) return;
    // Remove existing toast
    toastContainer.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>${message}`;
    toastContainer.appendChild(toast);
    // Auto-remove after animation completes
    setTimeout(() => { toast.remove(); }, 2200);
  }

  // ─── Progress Bar ────────────────────────────────────
  const progressBar = document.getElementById('progressBar');
  const backToTop = document.getElementById('backToTop');
  const progressRing = document.getElementById('progressRing');
  const ringCircumference = 2 * Math.PI * 21; // ~131.95

  // ─── Navbar Auto-Hide on Scroll (mobile) ─────────────
  const navbar = document.getElementById('navbar');
  let lastScrollY = 0;
  let scrollDelta = 0;
  const SCROLL_THRESHOLD = 60;

  function handleScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

    // Progress bar
    if (progressBar) progressBar.style.width = progress + '%';

    // Back to top visibility
    if (backToTop) backToTop.classList.toggle('visible', scrollTop > 500);

    // Progress ring on back-to-top
    if (progressRing) {
      const scrollFraction = docHeight > 0 ? scrollTop / docHeight : 0;
      const offset = ringCircumference * (1 - scrollFraction);
      progressRing.style.strokeDashoffset = offset;
    }

    // Navbar scrolled state
    if (navbar) navbar.classList.toggle('scrolled', scrollTop > 50);

    // Navbar auto-hide on mobile (≤1024px)
    if (window.innerWidth <= 1024 && navbar) {
      const direction = scrollTop - lastScrollY;

      if (direction > 0) {
        // Scrolling down
        scrollDelta += direction;
        if (scrollDelta > SCROLL_THRESHOLD && scrollTop > 200) {
          navbar.classList.add('nav-hidden');
        }
      } else {
        // Scrolling up
        scrollDelta = 0;
        navbar.classList.remove('nav-hidden');
      }
    } else if (navbar) {
      navbar.classList.remove('nav-hidden');
    }

    lastScrollY = scrollTop;
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  // ─── Back to Top ─────────────────────────────────────
  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ─── Mobile Nav with Scroll Lock ─────────────────────
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavClose = document.getElementById('mobileNavClose');
  let savedScrollPos = 0;

  function openMobileNav() {
    savedScrollPos = window.scrollY;
    body.classList.add('nav-open');
    body.style.top = `-${savedScrollPos}px`;
    mobileNav.classList.add('open');
    // Show navbar when mobile nav is open
    if (navbar) navbar.classList.remove('nav-hidden');
  }

  function closeMobileNav() {
    body.classList.remove('nav-open');
    body.style.top = '';
    mobileNav.classList.remove('open');
    window.scrollTo(0, savedScrollPos);
  }

  if (navToggle) navToggle.addEventListener('click', openMobileNav);
  if (mobileNavClose) mobileNavClose.addEventListener('click', closeMobileNav);

  // Mobile nav links — close on click and update active state
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      
      // Close nav first
      body.classList.remove('nav-open');
      body.style.top = '';
      mobileNav.classList.remove('open');
      
      // Smooth scroll to target section
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        const headerOffset = 80;
        const elementPosition = targetSection.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ─── Active Nav Link (Desktop + Mobile) ───────────────
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-link');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  function updateActiveNav() {
    const scrollY = window.scrollY + 100;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        // Desktop nav
        navItems.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) link.classList.add('active');
        });
        // Mobile nav
        mobileNavLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${id}`) link.classList.add('active');
        });
      }
    });
  }
  window.addEventListener('scroll', updateActiveNav, { passive: true });

  // ─── Typewriter Wipe Reveal ──────────────────────────
  const typewriterEl = document.getElementById('typewriter');
  const phrases = [
    '76% Faster than WebSockets',
    '10-Byte Binary Frames',
    'Built-in Pub/Sub & RPC',
    'Auto Zod Validation',
    'Full TypeScript Support'
  ];
  let phraseIndex = 0;

  function rotatePhrases() {
    if (!typewriterEl) return;
    
    // Slide out tagline
    typewriterEl.classList.add('tagline-exit');
    
    setTimeout(() => {
      // Transition to next tagline
      phraseIndex = (phraseIndex + 1) % phrases.length;
      typewriterEl.textContent = phrases[phraseIndex];
      
      typewriterEl.classList.remove('tagline-exit');
      typewriterEl.classList.add('tagline-enter');
      
      // Clean enter class once animation completes
      setTimeout(() => {
        typewriterEl.classList.remove('tagline-enter');
      }, 1000);
      
    }, 400); // matches slide-out exit transition speed
  }

  if (typewriterEl) {
    typewriterEl.textContent = phrases[0];
    typewriterEl.classList.add('tagline-enter');
    setTimeout(() => {
      typewriterEl.classList.remove('tagline-enter');
    }, 1000);
    
    setInterval(rotatePhrases, 3500); // transition phrase every 3.5 seconds
  }

  // ─── Animated Counters ───────────────────────────────
  function animateCounters() {
    document.querySelectorAll('.stat-value[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target);
      if (!target) return;
      const duration = 2000;
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = target >= 1000 ? (current / 1000).toFixed(0) + 'K+' : current;
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    });
  }

  const heroObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { animateCounters(); heroObserver.disconnect(); }
  }, { threshold: 0.5 });
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) heroObserver.observe(heroStats);

  // ─── Bar Chart Animation ─────────────────────────────
  const barObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      document.querySelectorAll('.bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
      barObserver.disconnect();
    }
  }, { threshold: 0.3 });
  const barChart = document.querySelector('.bar-chart');
  if (barChart) barObserver.observe(barChart);

  // ─── Roadmap Progress ────────────────────────────────
  const roadmapObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      document.querySelectorAll('.progress-fill').forEach(bar => {
        bar.style.width = bar.dataset.width + '%';
      });
      roadmapObserver.disconnect();
    }
  }, { threshold: 0.3 });
  const roadmapProgress = document.querySelector('.roadmap-progress');
  if (roadmapProgress) roadmapObserver.observe(roadmapProgress);

  // ─── Scroll Animations ───────────────────────────────
  const fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

  // ─── Hero Install Copy (with toast) ──────────────────
  const copyHeroBtn = document.getElementById('copyHeroBtn');
  if (copyHeroBtn) {
    copyHeroBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('npm install afterlink');
      showToast('Copied to clipboard!');
      copyHeroBtn.classList.add('copied');
      copyHeroBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        copyHeroBtn.classList.remove('copied');
        copyHeroBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    });
  }

  const copySkillBtn = document.getElementById('copySkillBtn');
  if (copySkillBtn) {
    copySkillBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('npx skills add AJAYMYTH/afterlink-skill');
      showToast('Copied to clipboard!');
      copySkillBtn.classList.add('copied');
      copySkillBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        copySkillBtn.classList.remove('copied');
        copySkillBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    });
  }

  // ─── GitHub Stars ────────────────────────────────────
  const starCount = document.getElementById('starCount');
  if (starCount) {
    const cached = sessionStorage.getItem('githubStars');
    if (cached) { starCount.textContent = cached; }
    else {
      fetch('https://api.github.com/repos/AJAYMYTH/AfterLink')
        .then(res => res.json())
        .then(data => {
          if (data.stargazers_count !== undefined) {
            const count = data.stargazers_count;
            const display = count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count;
            starCount.textContent = display;
            sessionStorage.setItem('githubStars', display);
          }
        })
        .catch(() => { starCount.textContent = '0'; });
    }
  }

  // ─── Installation Tabs ───────────────────────────────
  document.querySelectorAll('.install-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.install-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.install-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ─── Terminal Copy Buttons (with toast) ──────────────
  document.querySelectorAll('.copy-btn-terminal').forEach(btn => {
    btn.addEventListener('click', () => {
      const codeEl = document.getElementById(btn.dataset.target);
      if (!codeEl) return;
      const text = codeEl.textContent.replace(/^\s*\$\s*/gm, '').trim();
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy';
      }, 2000);
    });
  });

  // ─── API Tabs ────────────────────────────────────────
  document.querySelectorAll('.api-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.api-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.api-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ─── API Accordion (with keyboard support) ──────────
  document.querySelectorAll('.api-item-header').forEach(header => {
    // Set ARIA attributes
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    const item = header.parentElement;
    header.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');

    function toggleItem() {
      item.classList.toggle('open');
      header.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    }

    header.addEventListener('click', toggleItem);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleItem();
      }
    });
  });

  // ─── FAQ Accordion (with keyboard support) ──────────
  document.querySelectorAll('.faq-question').forEach(question => {
    // Set ARIA attributes
    question.setAttribute('role', 'button');
    question.setAttribute('tabindex', '0');
    const item = question.parentElement;
    question.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');

    function toggleFaq() {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        const q = i.querySelector('.faq-question');
        if (q) q.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        question.setAttribute('aria-expanded', 'true');
      }
    }

    question.addEventListener('click', toggleFaq);
    question.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFaq();
      }
    });
  });

  // ─── FAQ Filters ─────────────────────────────────────
  document.querySelectorAll('.faq-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.faq-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.faq-item').forEach(item => {
        if (filter === 'all' || item.dataset.category === filter) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // ─── Frame Visualizer ────────────────────────────────
  const frameSelect = document.getElementById('frameSelect');
  const frameTypeByte = document.getElementById('frameTypeByte');
  const frameTypes = {
    REQUEST: '0x01', RESPONSE: '0x02', STREAM_START: '0x03',
    PUBLISH: '0x0C', SUBSCRIBE: '0x0A', PING: '0x07', ERROR: '0x06'
  };
  if (frameSelect) {
    frameSelect.addEventListener('change', () => {
      frameTypeByte.textContent = frameTypes[frameSelect.value] || '0x00';
    });
  }

  // ─── Playground ──────────────────────────────────────
  const presets = {
    ping: {
      server: `const { Server } = require('@afterlink/server');
const server = new Server({ port: 4000 });

server.on('ping', async (req, res) => {
  res.send({ message: 'pong', timestamp: Date.now() });
});

server.listen();`,
      client: `const { Client } = require('@afterlink/client');
const client = new Client('afterlink://localhost:4000');

await client.connect();
const result = await client.request('ping', {});
console.log(result);
// { message: 'pong', timestamp: 1748000000000 }`,
      output: `> Connecting to afterlink://localhost:4000...\n> Connected. Session: abc123\n> Sending REQUEST to 'ping'...\n> Received RESPONSE: { message: 'pong', timestamp: 1748000000000 }\n> Done.`
    },
    validation: {
      server: `const { z } = require('zod');

server.on('createUser',
  async (req, res) => {
    const user = await db.create(req.body);
    res.send({ user });
  },
  z.object({
    name: z.string().min(2),
    email: z.string().email()
  })
);`,
      client: `const result = await client.request('createUser', {
  name: 'Ajay',
  email: 'ajay@example.com'
});
console.log(result);
// { user: { id: 1, name: 'Ajay', email: 'ajay@example.com' } }`,
      output: `> Sending REQUEST to 'createUser'...\n> Server validating schema...\n> Validation passed.\n> Received RESPONSE: { user: { id: 1, name: 'Ajay', email: 'ajay@example.com' } }`
    },
    pubsub: {
      server: `server.on('sendMessage', async (req, res) => {
  const msg = await db.save(req.body);
  server.publish('chat.newMessage', msg);
  res.send({ ok: true });
});`,
      client: `await client.subscribe('chat.newMessage', (msg) => {
  console.log(\`[\${msg.from}]: \${msg.text}\`);
});

await client.request('sendMessage', {
  from: 'Ajay',
  text: 'Hello AfterLink!'
});`,
      output: `> Subscribed to 'chat.newMessage'\n> Sending REQUEST to 'sendMessage'...\n> Published to 'chat.newMessage'\n> [Ajay]: Hello AfterLink!\n> Received RESPONSE: { ok: true }`
    },
    streaming: {
      server: `server.on('streamData', async (req, res) => {
  const stream = res.stream();
  for (let i = 0; i < 5; i++) {
    stream.send({ chunk: i, data: 'part ' + i });
    await sleep(100);
  }
  stream.end();
});`,
      client: `const stream = await client.request('streamData', {});
for await (const chunk of stream) {
  console.log(chunk);
}`,
      output: `> Sending REQUEST to 'streamData'...\n> STREAM_START received\n> { chunk: 0, data: 'part 0' }\n> { chunk: 1, data: 'part 1' }\n> { chunk: 2, data: 'part 2' }\n> { chunk: 3, data: 'part 3' }\n> { chunk: 4, data: 'part 4' }\n> STREAM_END received`
    }
  };

  const serverCode = document.getElementById('serverCode');
  const clientCode = document.getElementById('clientCode');
  const outputBody = document.getElementById('outputBody');
  const runBtn = document.getElementById('runDemo');

  function loadPreset(name) {
    const p = presets[name];
    serverCode.value = p.server;
    clientCode.value = p.client;
    outputBody.textContent = 'Click "Run Demo" to see the output...';
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.preset-btn[data-preset="${name}"]`).classList.add('active');
  }

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
  });
  loadPreset('ping');

  if (runBtn) {
    runBtn.addEventListener('click', () => {
      const output = presets[document.querySelector('.preset-btn.active').dataset.preset].output;
      outputBody.textContent = '';
      let i = 0;
      function typeOutput() {
        if (i < output.length) {
          outputBody.textContent += output[i];
          i++;
          setTimeout(typeOutput, 20);
        }
      }
      typeOutput();
    });
  }

  // ─── Terminal Overflow Detection ─────────────────────
  function checkTerminalOverflow() {
    document.querySelectorAll('.terminal-body').forEach(el => {
      if (el.scrollWidth > el.clientWidth) {
        el.classList.add('has-overflow');
      } else {
        el.classList.remove('has-overflow');
      }
    });
  }
  checkTerminalOverflow();
  window.addEventListener('resize', checkTerminalOverflow);

  // ─── Form Validation ─────────────────────────────────
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');

  if (contactForm) {
    const nameInput = contactForm.querySelector('#name');
    const emailInput = contactForm.querySelector('#email');
    const messageInput = contactForm.querySelector('#message');

    function validateField(input, condition) {
      const group = input.closest('.form-group');
      if (!condition) {
        group.classList.add('error');
        input.classList.add('error');
        input.classList.remove('success');
      } else {
        group.classList.remove('error');
        input.classList.remove('error');
        input.classList.add('success');
      }
    }

    nameInput.addEventListener('blur', () => validateField(nameInput, nameInput.value.length >= 2));
    emailInput.addEventListener('blur', () => validateField(emailInput, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)));
    messageInput.addEventListener('blur', () => validateField(messageInput, messageInput.value.length >= 10));

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameValid = nameInput.value.length >= 2;
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value);
      const messageValid = messageInput.value.length >= 10;

      validateField(nameInput, nameValid);
      validateField(emailInput, emailValid);
      validateField(messageInput, messageValid);

      if (!nameValid || !emailValid || !messageValid) return;

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Sending...';

      try {
        const response = await fetch(contactForm.action, {
          method: 'POST',
          body: new FormData(contactForm),
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          contactForm.reset();
          contactForm.style.display = 'none';
          formSuccess.classList.add('show');
        } else {
          const data = await response.json();
          if (data.errors) {
            alert('Error: ' + data.errors.map(e => e.message).join(', '));
          } else {
            alert('Something went wrong. Please try again.');
          }
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send Message';
        }
      } catch (err) {
        alert('Network error. Please check your connection and try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send Message';
      }
    });
  }
});
