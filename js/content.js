/* ==========================================================================
   Peony — Supabase içerik katmanı

   Site, i18n/*.json dosyalarıyla anında açılır. Supabase yapılandırılmışsa
   güncel içerik arka planda çekilir, sözlüğün üzerine yazılır ve sayfa
   yeniden çizilir. Bağlantı yoksa ya da hata alırsa site sabit içerikle
   sorunsuz çalışmaya devam eder.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.PEONY_SUPABASE || {};
  var CACHE_KEY = 'peony.content.v1';
  var TABLES = ['content', 'services', 'plans', 'faqs', 'testimonials', 'gallery', 'settings'];

  function configured() { return !!(CFG.url && CFG.anonKey); }

  function rest(table, query) {
    return fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/' + (CFG.tablePrefix || '') + table + '?' + query, {
      headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey }
    }).then(function (r) {
      if (!r.ok) throw new Error(table + ': ' + r.status);
      return r.json();
    });
  }

  /* ---------- Çekilen satırları I18N sözlüğüne uygun hâle getir ---------- */

  function shape(raw) {
    var out = { content: {}, services: [], plans: [], faqs: [],
                testimonials: [], gallery: [], settings: {} };

    (raw.content || []).forEach(function (r) { out.content[r.key] = r.value || {}; });
    (raw.settings || []).forEach(function (r) { out.settings[r.key] = r.value || ''; });

    var live = function (rows) {
      return (rows || []).filter(function (r) { return r.is_active !== false; })
                         .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    };

    out.services = live(raw.services).map(function (r) {
      return { slug: r.slug, img: r.image_url, duration: r.duration, price: r.price,
               name: r.name || {}, description: r.description || {} };
    });
    out.plans = live(raw.plans).map(function (r) {
      return { featured: !!r.featured, price: r.price, per: r.per,
               name: r.name || {}, note: r.note || {}, items: r.items || {} };
    });
    out.faqs = live(raw.faqs).map(function (r) {
      return { question: r.question || {}, answer: r.answer || {} };
    });
    out.testimonials = live(raw.testimonials).map(function (r) {
      return { author: r.author, role: r.role, rating: r.rating || 5, body: r.body || {} };
    });
    out.gallery = live(raw.gallery).map(function (r) {
      return { url: r.image_url, category: r.category || 'details', caption: r.caption || {} };
    });
    return out;
  }

  /* ---------- Sözlüğe uygula ---------- */

  function pick(map, lang) {
    if (!map) return undefined;
    return map[lang] || map.en || map[Object.keys(map)[0]];
  }

  function apply(data) {
    if (!data || !window.I18N) return;
    var lang = window.I18N.current;

    var patch = {};

    Object.keys(data.content).forEach(function (key) {
      var v = pick(data.content[key], lang);
      if (typeof v === 'string') patch[key] = v;
    });

    if (data.services.length) {
      data.services.forEach(function (s) {
        patch['svc.' + s.slug + '.name'] = pick(s.name, lang) || '';
        patch['svc.' + s.slug + '.desc'] = pick(s.description, lang) || '';
      });
    }

    var lists = {};
    if (data.plans.length) {
      lists['plans.items'] = data.plans.map(function (p) {
        return { name: pick(p.name, lang) || '', note: pick(p.note, lang) || '',
                 items: pick(p.items, lang) || [], price: p.price, per: p.per,
                 featured: p.featured };
      });
    }
    if (data.faqs.length) {
      lists['faq.items'] = data.faqs.map(function (f) {
        return { q: pick(f.question, lang) || '', a: pick(f.answer, lang) || '' };
      });
    }
    if (data.testimonials.length) {
      lists['quotes.items'] = data.testimonials.map(function (t) {
        return { text: pick(t.body, lang) || '', name: t.author || '', role: t.role || '',
                 rating: t.rating };
      });
    }

    window.I18N.override(patch, lists);

    window.PEONY_DATA = data;
    applySettings(data.settings);
    applyMedia(data.settings);
    applyMap(data.settings);
  }

  /* ---------- Ayarlar: iletişim bilgileri, saatler, sosyal ---------- */

  function applySettings(s) {
    if (!s) return;

    document.querySelectorAll('[data-setting]').forEach(function (el) {
      var v = s[el.getAttribute('data-setting')];
      if (v === undefined || v === '') return;
      el.textContent = v;
      el.classList.remove('tbd');
    });

    document.querySelectorAll('[data-setting-href]').forEach(function (el) {
      var spec = el.getAttribute('data-setting-href').split(':');
      var v = s[spec[spec.length - 1]];
      if (!v) return;
      var scheme = spec.length > 1 ? spec[0] : '';
      el.setAttribute('href', scheme ? scheme + ':' + v : v);
    });
  }

  /* ---------- Görsel ve video adresleri ---------- */

  var MEDIA = [
    ['hero_video',   '.hero__media source', 'src'],
    ['hero_poster',  '.hero__media video',  'poster'],
    ['about_inline', '.inline-media',       'src'],
    ['about_1',      '.about__strip figure:nth-child(1) img', 'src'],
    ['about_2',      '.about__strip figure:nth-child(2) img', 'src'],
    ['about_3',      '.about__strip figure:nth-child(3) img', 'src'],
    ['ambience',     '.band__bg img',       'src'],
    ['footer_bg',    '.foot__bg img',       'src']
  ];

  function applyMedia(s) {
    if (!s) return;
    var videoChanged = false;

    MEDIA.forEach(function (m) {
      var val = s[m[0]];
      if (!val) return;
      var el = document.querySelector(m[1]);
      if (!el || el.getAttribute(m[2]) === val) return;
      el.setAttribute(m[2], val);
      if (m[1].indexOf('.hero__media') === 0) videoChanged = true;
    });

    var v = document.querySelector('.hero__media video');
    if (v && videoChanged) { try { v.load(); v.play().catch(function () {}); } catch (e) {} }

    if (s.hero_poster) {
      var media = document.querySelector('.hero__media');
      if (media) media.style.backgroundImage = 'url("' + s.hero_poster + '")';
    }
  }

  /* ---------- Harita ---------- */

  function applyMap(s) {
    var sec = document.getElementById('mapSection');
    if (!sec || !s || !s.map_embed) return;

    var src = s.map_embed.trim();
    // Yönetici Google'dan kopyalanan tam <iframe ...> kodunu da yapıştırabilir
    var m = src.match(/src=["']([^"']+)["']/i);
    if (m) src = m[1];
    if (!/^https?:\/\//i.test(src)) return;

    if (sec.querySelector('iframe[src="' + src + '"]')) return;
    sec.innerHTML = '<iframe class="map" src="' + src + '" loading="lazy" ' +
                    'referrerpolicy="no-referrer-when-downgrade" ' +
                    'title="Peony Thai Massage &amp; Spa"></iframe>';
  }

  /* ---------- Galeri ---------- */

  function applyGallery(data) {
    var grid = document.getElementById('galGrid');
    if (!grid || !data.gallery.length) return;

    grid.innerHTML = data.gallery.map(function (g, i) {
      var wide = (i % 5 === 1) ? ' wide' : '';
      return '<figure class="reveal' + wide + '" style="--d:' + (i % 3) * 80 + 'ms" ' +
             'data-cat="' + g.category + '">' +
             '<img src="' + g.url + '" alt="" loading="lazy" ' +
             'onerror="this.onerror=null;this.src=\'assets/placeholder.svg\'"></figure>';
    }).join('');

    // Hangi kategoriler gerçekten doluysa sadece onların düğmesi kalsın
    var present = {};
    data.gallery.forEach(function (g) { present[g.category] = true; });
    document.querySelectorAll('.gal-filter button').forEach(function (b) {
      var c = b.dataset.cat;
      if (c !== 'all' && !present[c]) b.remove();
    });

    document.dispatchEvent(new CustomEvent('peony:gallery'));
  }

  function applyMosaic(data) {
    var mosaic = document.querySelector('.mosaic');
    if (!mosaic || !data.gallery.length) return;
    mosaic.innerHTML = data.gallery.slice(0, 6).map(function (g, i) {
      return '<figure class="reveal" style="--d:' + (i % 3) * 80 + 'ms">' +
             '<img src="' + g.url + '" alt="" loading="lazy" ' +
             'onerror="this.onerror=null;this.src=\'assets/placeholder.svg\'"></figure>';
    }).join('');
    document.dispatchEvent(new CustomEvent('peony:mosaic'));
  }

  /* ---------- Yükleme akışı ---------- */

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function writeCache(d) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  function useData(data) {
    apply(data);
    applyGallery(data);
    applyMosaic(data);
  }

  /* Sayfa çözümlenmeden veri çekmeye başlıyoruz; DOM'a yazmak için de
     hem DOM'un hem sözlüğün hazır olmasını bekliyoruz. Böylece ağ isteği
     HTML çözümlemesiyle paralel ilerliyor ve panelden yüklenen görseller
     sayfa açıldıktan çok sonra değil, ilk boyamaya yakın yerine oturuyor. */
  function whenReady() {
    return new Promise(function (resolve) {
      var go = function () {
        if (window.I18N) return resolve();
        document.addEventListener('peony:lang', function h() {
          document.removeEventListener('peony:lang', h); resolve();
        });
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', go);
      } else { go(); }
    });
  }

  /* Panelden gelen görselleri tarayıcıya erkenden duyur ki indirme,
     src değişmesini beklemeden başlasın. */
  function preloadMedia(settings) {
    if (!settings) return;
    ['hero_poster', 'about_inline', 'about_1', 'about_2', 'about_3'].forEach(function (k) {
      var url = settings[k];
      if (!url || document.querySelector('link[rel="preload"][href="' + url + '"]')) return;
      var l = document.createElement('link');
      l.rel = 'preload'; l.as = 'image'; l.href = url;
      (document.head || document.documentElement).appendChild(l);
    });
  }

  function load() {
    if (!configured()) return;

    var cached = readCache();
    if (cached) {
      preloadMedia(cached.settings);          // önbellekten: indirme hemen başlar
      whenReady().then(function () { useData(cached); });
    }

    Promise.all(TABLES.map(function (t) {
      return rest(t, 'select=*').catch(function (e) {
        console.warn('[content]', e.message);
        return null;
      });
    })).then(function (res) {
      var raw = {};
      TABLES.forEach(function (t, i) { if (res[i]) raw[t] = res[i]; });
      if (!Object.keys(raw).length) return;
      var data = shape(raw);
      writeCache(data);
      preloadMedia(data.settings);
      return whenReady().then(function () { useData(data); });
    });
  }

  // Dil değişince aynı veriyi yeni dile göre yeniden uygula
  document.addEventListener('peony:lang', function () {
    if (window.PEONY_DATA) apply(window.PEONY_DATA);
  });

  load();
})();
