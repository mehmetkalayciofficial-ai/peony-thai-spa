/* ==========================================================================
   Peony — interactions
   ========================================================================== */
(function () {
  'use strict';

  var PH = 'assets/placeholder.svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function img(src, cls) {
    return '<img src="' + src + '" alt="" loading="lazy" ' +
           (cls ? 'class="' + cls + '" ' : '') +
           'onerror="this.onerror=null;this.src=\'' + PH + '\'">';
  }

  var CHECK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
              '<path d="M2.5 8.5 6 12l7.5-8" stroke="currentColor" stroke-width="1.6" ' +
              'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var STAR = '<svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
             '<path d="M10 1.6l2.4 5.1 5.6.7-4.1 3.9 1 5.6L10 14.2l-4.9 2.7 1-5.6L2 7.4l5.6-.7L10 1.6z"/></svg>';

  var ARROW = '<svg class="arw" width="15" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">' +
              '<path d="M1 6h13M9.5 1.5 14 6l-4.5 4.5" stroke="currentColor" stroke-width="1.4" ' +
              'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* Media + metadata that never changes with language. */
  var SERVICES = [
    { id: 'thai',   img: 'assets/art/svc-thai.svg'   },
    { id: 'oil',    img: 'assets/art/svc-oil.svg'    },
    { id: 'aroma',  img: 'assets/art/svc-aroma.svg'  },
    { id: 'foot',   img: 'assets/art/svc-foot.svg'   },
    { id: 'back',   img: 'assets/art/svc-back.svg'   },
    { id: 'herbal', img: 'assets/art/svc-herbal.svg' },
    { id: 'scrub',  img: 'assets/art/svc-scrub.svg'  },
    { id: 'facial', img: 'assets/art/svc-facial.svg' }
  ];

  var TBD = '<span class="tbd">-doldurulacak-</span>';

  /* ======================================================================
     Reveal on scroll
     ====================================================================== */
  var revealObserver = null;

  function initReveal() {
    if (reduced) { $$('.reveal').forEach(function (el) { el.classList.add('is-in'); }); return; }

    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        revealObserver.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    observeReveals();

    /* Safety net: if the observer never fires (background tab, throttled
       timers, an unusual engine), show everything rather than leave the
       page blank. */
    var failsafe = function () {
      if (document.querySelector('.reveal.is-in')) return;
      $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
    };
    setTimeout(failsafe, 3000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') observeReveals();
    });
  }

  function observeReveals(root) {
    if (reduced) {
      $$('.reveal', root).forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    if (!revealObserver) return;
    $$('.reveal', root).forEach(function (el) {
      if (!el.classList.contains('is-in')) revealObserver.observe(el);
    });
  }

  /* ======================================================================
     Navbar + drawer + language dropdown
     ====================================================================== */
  function initNav() {
    var nav = $('#nav');
    if (!nav) return;

    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Drawer */
    var burger = $('#burger');
    var drawer = $('#drawer');
    if (burger && drawer) {
      var setOpen = function (open) {
        nav.classList.toggle('is-open', open);
        drawer.classList.toggle('is-open', open);
        document.body.classList.toggle('is-locked', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');

        // stagger the drawer links in
        $$('a', drawer).forEach(function (a, i) {
          a.style.transitionDelay = open ? (60 + i * 55) + 'ms' : '0ms';
        });
      };
      burger.addEventListener('click', function () {
        setOpen(!nav.classList.contains('is-open'));
      });
      $$('a', drawer).forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false);
      });
    }

    /* Language dropdown */
    var lang = $('#lang');
    if (lang) {
      var btn = $('.lang__btn', lang);
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = lang.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!lang.contains(e.target)) {
          lang.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          lang.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      lang.addEventListener('click', function (e) {
        if (e.target.closest('.lang__menu button')) {
          lang.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    /* Highlight the current page link */
    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav__links a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href && href.indexOf('#') !== 0 && href === here) a.classList.add('is-active');
    });
  }

  /* ======================================================================
     Dynamic sections (re-rendered on every language change)
     ====================================================================== */
  function renderServices() {
    var grid = $('#svcGrid');
    if (!grid) return;

    grid.innerHTML = SERVICES.map(function (s, i) {
      var d = Math.min(i, 3) * 90;
      return '' +
      '<article class="svc reveal" style="--d:' + d + 'ms">' +
        '<div class="svc__media">' + img(s.img) + '</div>' +
        '<div class="svc__body">' +
          '<h3>' + I18N.t('svc.' + s.id + '.name') + '</h3>' +
          '<p>' + I18N.t('svc.' + s.id + '.desc') + '</p>' +
          '<div class="svc__meta"><span>' + TBD + '</span><span>' + TBD + '</span></div>' +
        '</div>' +
      '</article>';
    }).join('');

    observeReveals(grid);
  }

  function renderPlans() {
    var grid = $('#plansGrid');
    if (!grid) return;

    var plans = I18N.list('plans.items');
    grid.innerHTML = plans.map(function (p, i) {
      var feature = i === 1;
      var items = (p.items || []).map(function (t) {
        return '<li>' + CHECK + '<span>' + t + '</span></li>';
      }).join('');

      return '' +
      '<article class="plan' + (feature ? ' plan--feature' : '') + ' reveal" style="--d:' + (i * 100) + 'ms">' +
        (feature ? '<span class="plan__badge">' + I18N.t('plans.badge') + '</span>' : '') +
        '<h3>' + p.name + '</h3>' +
        '<p class="plan__note">' + p.note + '</p>' +
        '<div class="plan__price">' +
          '<span class="amt">' + TBD + '</span>' +
          '<span class="per">' + TBD + '</span>' +
        '</div>' +
        '<ul>' + items + '</ul>' +
        '<a class="btn' + (feature ? '' : ' btn--ghost') + '" href="contact.html">' +
          '<span>' + I18N.t('plans.cta') + '</span>' + ARROW +
        '</a>' +
      '</article>';
    }).join('');

    observeReveals(grid);
  }

  var quotes = { i: 0, timer: null };

  function renderQuotes() {
    var track = $('#quotesTrack');
    var dots = $('#quotesDots');
    if (!track || !dots) return;

    var items = I18N.list('quotes.items');
    if (!items.length) return;

    track.innerHTML = items.map(function (q) {
      return '' +
      '<div class="quotes__slide">' +
        '<div class="stars" aria-label="5 / 5">' + STAR + STAR + STAR + STAR + STAR + '</div>' +
        '<blockquote>“' + q.text + '”</blockquote>' +
        '<cite>' + q.name + '<small>' + q.role + '</small></cite>' +
      '</div>';
    }).join('');

    dots.innerHTML = items.map(function (_, i) {
      return '<button type="button" aria-label="' + (i + 1) + '" aria-current="' +
             (i === 0 ? 'true' : 'false') + '"></button>';
    }).join('');

    quotes.i = 0;
    goToQuote(0);

    $$('button', dots).forEach(function (b, i) {
      b.addEventListener('click', function () { goToQuote(i); restartQuotes(items.length); });
    });

    restartQuotes(items.length);
  }

  function goToQuote(i) {
    var track = $('#quotesTrack');
    var dots = $('#quotesDots');
    if (!track) return;
    quotes.i = i;
    track.style.transform = 'translateX(' + (-i * 100) + '%)';
    $$('button', dots).forEach(function (b, k) {
      b.setAttribute('aria-current', k === i ? 'true' : 'false');
    });
  }

  function restartQuotes(total) {
    clearInterval(quotes.timer);
    if (reduced || total < 2) return;
    quotes.timer = setInterval(function () {
      goToQuote((quotes.i + 1) % total);
    }, 6500);
  }

  function renderFaq() {
    var list = $('#faqList');
    if (!list) return;

    var items = I18N.list('faq.items');
    list.innerHTML = items.map(function (f, i) {
      return '' +
      '<div class="faq__item reveal" style="--d:' + Math.min(i, 4) * 70 + 'ms">' +
        '<button class="faq__q" type="button" aria-expanded="false" aria-controls="faq-a-' + i + '">' +
          '<span>' + f.q + '</span><span class="faq__sign" aria-hidden="true"></span>' +
        '</button>' +
        '<div class="faq__a" id="faq-a-' + i + '"><div><p>' + f.a + '</p></div></div>' +
      '</div>';
    }).join('');

    $$('.faq__q', list).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq__item');
        var open = item.classList.contains('is-open');

        $$('.faq__item', list).forEach(function (other) {
          other.classList.remove('is-open');
          $('.faq__q', other).setAttribute('aria-expanded', 'false');
        });

        if (!open) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    observeReveals(list);
  }

  /* ======================================================================
     Parallax band
     ====================================================================== */
  function initParallax() {
    var els = $$('[data-parallax]');
    if (!els.length || reduced) return;

    var ticking = false;
    var update = function () {
      els.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        var progress = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        el.style.transform = 'translate3d(0,' + (progress * -7).toFixed(2) + '%,0)';
      });
      ticking = false;
    };

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ======================================================================
     Hero video — the poster attribute already covers slow or blocked
     playback, so never tear the element out of the DOM.
     ====================================================================== */
  function initHeroVideo() {
    var v = $('.hero__media video');
    if (!v) return;

    // Autoplay can be refused (data saver, reduced motion, power saving).
    // That is fine: the poster frame stays on screen.
    var play = v.play();
    if (play && play.catch) play.catch(function () {});

    // Only if the browser reports it has no usable source at all do we fall
    // back to a plain image, so the hero is never an empty block.
    v.addEventListener('error', function () {
      if (v.dataset.failed) return;
      v.dataset.failed = '1';
      var el = document.createElement('img');
      el.src = v.getAttribute('poster') || PH;
      el.alt = '';
      el.onerror = function () { el.onerror = null; el.src = PH; };
      v.replaceWith(el);
    });
  }

  /* ======================================================================
     Gallery page — filter + lightbox
     ====================================================================== */
  function initGallery() {
    var grid = $('#galGrid');
    if (!grid) return;

    var figures = $$('figure', grid);

    /* Filter */
    $$('.gal-filter button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.dataset.cat;
        $$('.gal-filter button').forEach(function (b) {
          b.setAttribute('aria-current', b === btn ? 'true' : 'false');
        });
        figures.forEach(function (f) {
          var show = cat === 'all' || f.dataset.cat === cat;
          f.classList.toggle('hide', !show);
        });
      });
    });

    /* Lightbox */
    var box = $('#lightbox');
    if (!box) return;
    var boxImg = $('img', box);
    var count = $('.lightbox__count', box);
    var idx = 0;

    var visible = function () { return figures.filter(function (f) { return !f.classList.contains('hide'); }); };

    var show = function (i) {
      var list = visible();
      if (!list.length) return;
      idx = (i + list.length) % list.length;
      var src = $('img', list[idx]).src;
      boxImg.src = src;
      count.textContent = (idx + 1) + ' / ' + list.length;
    };

    var open = function (fig) {
      var list = visible();
      show(list.indexOf(fig));
      box.classList.add('is-open');
      document.body.classList.add('is-locked');
      $('.lightbox__close', box).focus();
    };

    var close = function () {
      box.classList.remove('is-open');
      document.body.classList.remove('is-locked');
    };

    figures.forEach(function (f) {
      f.addEventListener('click', function () { open(f); });
      f.setAttribute('tabindex', '0');
      f.setAttribute('role', 'button');
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(f); }
      });
    });

    $('.lightbox__close', box).addEventListener('click', close);
    $('.lightbox__prev', box).addEventListener('click', function () { show(idx - 1); });
    $('.lightbox__next', box).addEventListener('click', function () { show(idx + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* Treatment dropdown on the contact page — kept in sync with the language */
  function renderServiceSelect() {
    var sel = $('#f-service');
    if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = '<option value="" disabled selected>' +
                    I18N.t('contact.form.servicePick') + '</option>' +
      SERVICES.map(function (s) {
        return '<option value="' + s.id + '">' + I18N.t('svc.' + s.id + '.name') + '</option>';
      }).join('');
    if (keep) sel.value = keep;
  }

  /* ======================================================================
     Contact form (placeholder submit until a backend is wired up)
     ====================================================================== */
  function initForm() {
    var form = $('#bookForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('#formNote');
      if (note) {
        note.textContent = I18N.t('contact.form.sent');
        note.style.color = 'var(--green)';
      }
      form.reset();
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  function renderAll() {
    renderServices();
    renderPlans();
    renderQuotes();
    renderFaq();
    renderServiceSelect();
  }

  function boot() {
    initReveal();
    initNav();
    initParallax();
    initHeroVideo();
    initGallery();
    initForm();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('peony:lang', function () {
    renderAll();
    observeReveals();
  });
})();
