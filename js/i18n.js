/* ==========================================================================
   Peony — i18n engine
   Loads i18n/<lang>.json, fills every [data-i18n] node, and broadcasts
   a "peony:lang" event so dynamic sections can re-render.
   ========================================================================== */
(function () {
  'use strict';

  var LANGS = [
    { code: 'th', label: 'ไทย',     short: 'TH', flag: '🇹🇭' },
    { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
    { code: 'tr', label: 'Türkçe',  short: 'TR', flag: '🇹🇷' },
    { code: 'ru', label: 'Русский', short: 'RU', flag: '🇷🇺' },
    { code: 'zh', label: '中文',     short: 'ZH', flag: '🇨🇳' },
    { code: 'hi', label: 'हिन्दी',    short: 'HI', flag: '🇮🇳' }
  ];

  var FALLBACK = 'en';
  var STORE_KEY = 'peony.lang';

  /* Extra webfonts pulled in only when a script actually needs them. */
  var SCRIPT_FONTS = {
    th: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500&display=swap',
    zh: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500&display=swap',
    hi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@300;400;500&display=swap'
  };

  var dict = {};
  var current = FALLBACK;
  var cache = {};

  /* ---------- helpers ---------- */

  function get(key) {
    var parts = key.split('.');
    var node = dict;
    for (var i = 0; i < parts.length; i++) {
      if (node === null || typeof node !== 'object') return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function loadScriptFont(code) {
    var href = SCRIPT_FONTS[code];
    if (!href || document.querySelector('link[data-script-font="' + code + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-script-font', code);
    document.head.appendChild(link);
  }

  function detect() {
    var stored = null;
    try { stored = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (stored && findLang(stored)) return stored;

    var path = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (findLang(path)) return path;

    var q = new URLSearchParams(location.search).get('lang');
    if (q && findLang(q)) return q;

    var navs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < navs.length; i++) {
      var base = String(navs[i]).slice(0, 2).toLowerCase();
      if (findLang(base)) return base;
    }
    return FALLBACK;
  }

  function findLang(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return null;
  }

  /* ---------- DOM application ---------- */

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = get(el.getAttribute('data-i18n'));
      if (typeof val === 'string') el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      // format: "placeholder:contact.form.namePh, aria-label:nav.book"
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length < 2) return;
        var val = get(bits[1].trim());
        if (typeof val === 'string') el.setAttribute(bits[0].trim(), val);
      });
    });

    var title = get('meta.title');
    if (title) document.title = title;

    var desc = get('meta.description');
    var descTag = document.querySelector('meta[name="description"]');
    if (desc && descTag) descTag.setAttribute('content', desc);
  }

  function paintSwitcher() {
    document.querySelectorAll('[data-lang-current]').forEach(function (el) {
      var l = findLang(current);
      el.textContent = l ? l.short : current.toUpperCase();
    });

    document.querySelectorAll('.lang__menu').forEach(function (menu) {
      if (menu.childElementCount) {
        menu.querySelectorAll('button').forEach(function (b) {
          b.setAttribute('aria-current', b.dataset.lang === current ? 'true' : 'false');
        });
        return;
      }
      LANGS.forEach(function (l) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.lang = l.code;
        b.setAttribute('role', 'menuitem');
        b.setAttribute('aria-current', l.code === current ? 'true' : 'false');
        b.innerHTML = '<span aria-hidden="true">' + l.flag + '</span>' +
                      '<span>' + l.label + '</span>' +
                      '<span class="code">' + l.short + '</span>';
        b.addEventListener('click', function () { setLang(l.code); });
        menu.appendChild(b);
      });
    });
  }

  /* ---------- public ---------- */

  function setLang(code, silent) {
    var lang = findLang(code) ? code : FALLBACK;

    var finish = function () {
      dict = cache[lang] || {};
      current = lang;
      document.documentElement.lang = lang;
      loadScriptFont(lang);
      apply();
      paintSwitcher();
      if (!silent) { try { localStorage.setItem(STORE_KEY, lang); } catch (e) {} }
      document.dispatchEvent(new CustomEvent('peony:lang', { detail: { lang: lang } }));
    };

    if (cache[lang]) { finish(); return Promise.resolve(); }

    return fetch('i18n/' + lang + '.json')
      .then(function (r) {
        if (!r.ok) throw new Error('missing dictionary: ' + lang);
        return r.json();
      })
      .then(function (json) { cache[lang] = json; finish(); })
      .catch(function (err) {
        console.warn('[i18n]', err.message);
        if (lang !== FALLBACK) return setLang(FALLBACK, silent);
        finish();
      });
  }

  /* Supabase içeriği geldiğinde sözlüğün üzerine yazmak için. */
  function deepSet(obj, path, val) {
    var parts = path.split('.'), n = obj, i;
    for (i = 0; i < parts.length - 1; i++) {
      if (typeof n[parts[i]] !== 'object' || n[parts[i]] === null) n[parts[i]] = {};
      n = n[parts[i]];
    }
    n[parts[parts.length - 1]] = val;
  }

  window.I18N = {
    langs: LANGS,
    /* patch: {"hero.title": "..."} — lists: {"faq.items": [...]} */
    override: function (patch, lists) {
      var k;
      for (k in (patch || {})) deepSet(dict, k, patch[k]);
      for (k in (lists || {})) deepSet(dict, k, lists[k]);
      apply();
      document.dispatchEvent(new CustomEvent('peony:content'));
    },
    t: function (key, fb) {
      var v = get(key);
      return typeof v === 'string' ? v : (fb !== undefined ? fb : key);
    },
    list: function (key) {
      var v = get(key);
      return Array.isArray(v) ? v : [];
    },
    get current() { return current; },
    set: setLang
  };

  setLang(detect(), true);
})();
