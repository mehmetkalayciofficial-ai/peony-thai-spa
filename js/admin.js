/* ==========================================================================
   Peony — yönetim paneli

   Tüm site içeriği (metinler, hizmetler, paketler, S.S.S., yorumlar,
   galeri, görseller ve iletişim bilgileri) buradan düzenlenir.
   Veriler Supabase'de, görseller Supabase Storage'ın "media" kovasında.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- kısayol */
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var toastTimer;
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, kind === 'err' ? 6000 : 3000);
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ---------------------------------------------------------------- durum */
  var LANGS = [
    { code: 'th', label: 'ไทย',     short: 'Tayca'   },
    { code: 'en', label: 'English', short: 'İngilizce' },
    { code: 'tr', label: 'Türkçe',  short: 'Türkçe'  },
    { code: 'ru', label: 'Русский', short: 'Rusça'   },
    { code: 'zh', label: '中文',     short: 'Çince'   },
    { code: 'hi', label: 'हिन्दी',    short: 'Hintçe'  }
  ];

  var CFG = window.PEONY_SUPABASE || {};
  var sb = null;
  var lang = 'tr';
  var tab = 'texts';
  var dirty = false;

  var DATA = { content: [], services: [], plans: [], faqs: [],
               testimonials: [], gallery: [], settings: [] };
  var REMOVED = { services: [], plans: [], faqs: [], testimonials: [], gallery: [] };

  /* ---------------------------------------------------------------- metin grupları */
  var TEXT_GROUPS = [
    { title: 'Üst menü',            match: /^nav\./ },
    { title: 'Giriş bölümü (hero)', match: /^hero\./ },
    { title: 'Hakkımızda',          match: /^about\./ },
    { title: 'Hizmetler başlığı',   match: /^services\./ },
    { title: 'Ara bölüm (ambiyans)',match: /^band\./ },
    { title: 'Paketler başlığı',    match: /^plans\./ },
    { title: 'Yorumlar başlığı',    match: /^quotes\./ },
    { title: 'S.S.S. başlığı',      match: /^faq\./ },
    { title: 'Galeri',              match: /^(gal|gallery)\./ },
    { title: 'İletişim sayfası',    match: /^contact\./ },
    { title: 'Alt bilgi (footer)',  match: /^foot\./ },
    { title: 'Site başlığı & açıklaması', match: /^meta\./ }
  ];

  var LABELS = {
    'hero.eyebrow': 'Üst etiket', 'hero.title': 'Ana başlık', 'hero.text': 'Açıklama',
    'hero.cta1': 'Birinci buton', 'hero.cta2': 'İkinci buton', 'hero.scroll': 'Kaydır yazısı',
    'about.eyebrow': 'Üst etiket', 'about.title1': 'Başlık — görselden önce',
    'about.title2': 'Başlık — görselden sonra', 'about.text': 'Açıklama', 'about.cta': 'Buton',
    'about.stat1': '1. sayaç etiketi', 'about.stat2': '2. sayaç etiketi', 'about.stat3': '3. sayaç etiketi',
    'services.eyebrow': 'Üst etiket', 'services.title': 'Başlık', 'services.text': 'Açıklama',
    'band.eyebrow': 'Üst etiket', 'band.quote': 'Cümle',
    'plans.eyebrow': 'Üst etiket', 'plans.title': 'Başlık', 'plans.text': 'Açıklama',
    'plans.badge': 'Öne çıkan rozeti', 'plans.cta': 'Buton',
    'quotes.eyebrow': 'Üst etiket', 'quotes.title': 'Başlık',
    'faq.eyebrow': 'Üst etiket', 'faq.title': 'Başlık',
    'meta.title': 'Tarayıcı sekme başlığı', 'meta.description': 'Arama motoru açıklaması',
    'foot.ctaEyebrow': 'Üst etiket', 'foot.ctaTitle': 'Başlık', 'foot.ctaText': 'Açıklama',
    'foot.ctaBtn': 'Randevu butonu', 'foot.ctaCall': 'Arama butonu',
    'foot.hours': 'Saatler başlığı', 'foot.weekdays': 'Hafta içi etiketi',
    'foot.weekend': 'Hafta sonu etiketi', 'foot.visit': 'Adres başlığı',
    'foot.follow': 'Sosyal medya başlığı', 'foot.rights': 'Telif satırı'
  };

  function labelFor(key) {
    if (LABELS[key]) return LABELS[key];
    return key.split('.').pop().replace(/([A-Z])/g, ' $1').toLowerCase();
  }

  /* ---------------------------------------------------------------- kayıt bayrağı */
  function markDirty() {
    dirty = true;
    $('#save').disabled = false;
    $('#status').textContent = 'Kaydedilmemiş değişiklikler var';
  }
  function clearDirty() {
    dirty = false;
    $('#save').disabled = true;
    $('#status').textContent = 'Tüm değişiklikler kaydedildi';
  }
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------------------------------------------------------------- giriş */
  /* Supabase e-posta ile kimlik doğrular; panelde kullanıcı adı yazmak
     yeterli olsun diye alan adı burada tamamlanıyor. Tam e-posta yazılırsa
     olduğu gibi kullanılır. */
  var LOGIN_DOMAIN = 'peonythaispa.com';
  function loginEmail(v) {
    v = String(v || '').trim().toLowerCase();
    return v.indexOf('@') > -1 ? v : v + '@' + LOGIN_DOMAIN;
  }

  function initAuth() {
    if (!CFG.url || !CFG.anonKey) {
      $('#setupWarn').classList.remove('hidden');
      $('#loginForm').classList.add('hidden');
      return;
    }
    sb = window.supabase.createClient(CFG.url, CFG.anonKey);

    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) enter(r.data.session);
    });

    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#lgBtn');
      btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';
      sb.auth.signInWithPassword({ email: loginEmail($('#lgEmail').value), password: $('#lgPass').value })
        .then(function (r) {
          if (r.error) throw r.error;
          enter(r.data.session);
        })
        .catch(function (err) { toast(errText(err), 'err'); })
        .finally(function () { btn.disabled = false; btn.textContent = 'Giriş yap'; });
    });

    $('#logout').addEventListener('click', function () {
      if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Yine de çıkılsın mı?')) return;
      sb.auth.signOut().then(function () { location.reload(); });
    });

    $('#viewSite').addEventListener('click', function () { window.open('index.html', '_blank'); });
  }

  function errText(err) {
    var m = (err && (err.message || err.error_description)) || 'Bilinmeyen hata';
    if (/Invalid login/i.test(m)) return 'E-posta veya parola hatalı.';
    if (/Email not confirmed/i.test(m)) return 'E-posta adresi henüz doğrulanmamış.';
    if (/Failed to fetch/i.test(m)) return 'Supabase adresine ulaşılamadı. Bağlantıyı kontrol edin.';
    return m;
  }

  function enter(session) {
    $('#login').classList.add('hidden');
    $('#shell').classList.remove('hidden');
    $('#who').textContent = (session.user && session.user.email) || '';
    buildLangbar();
    bindTabs();
    loadAll();
  }

  /* Peony tabloları ortak bir veritabanını paylaştığı için "peony_" önekli.
     Önek yapılandırmadan gelir; ayrı projeye taşınınca boşaltmak yeterli. */
  function T(name) { return (CFG.tablePrefix || '') + name; }
  function BUCKET() { return CFG.bucket || 'media'; }

  /* ---------------------------------------------------------------- veri */
  function loadAll() {
    $('#pane').innerHTML = '<div class="empty">Yükleniyor…</div>';
    var tables = Object.keys(DATA);
    Promise.all(tables.map(function (t) {
      var q = sb.from(T(t)).select('*');
      if (t !== 'content' && t !== 'settings') q = q.order('position', { ascending: true });
      return q;
    })).then(function (res) {
      var failed = [];
      res.forEach(function (r, i) {
        if (r.error) { failed.push(tables[i] + ': ' + r.error.message); DATA[tables[i]] = []; }
        else DATA[tables[i]] = r.data || [];
      });
      if (failed.length) {
        toast('Bazı tablolar okunamadı — schema.sql çalıştırıldı mı? (' + failed[0] + ')', 'err');
      }
      render();
      clearDirty();
    });
  }

  function row(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function setting(key) {
    for (var i = 0; i < DATA.settings.length; i++) if (DATA.settings[i].key === key) return DATA.settings[i];
    var s = { key: key, value: '' };
    DATA.settings.push(s);
    return s;
  }

  function contentRow(key) {
    for (var i = 0; i < DATA.content.length; i++) if (DATA.content[i].key === key) return DATA.content[i];
    var c = { key: key, value: {} };
    DATA.content.push(c);
    return c;
  }

  /* ---------------------------------------------------------------- sekmeler */
  var TABS = {
    texts:    { title: 'Metinler',  note: 'Sayfalardaki sabit yazılar. Her dil ayrı düzenlenir.', langs: true },
    services: { title: 'Hizmetler', note: 'Ana sayfadaki uygulama kartları.', langs: true },
    plans:    { title: 'Paketler',  note: 'Fiyat kartları. Ortadaki öne çıkan olarak gösterilir.', langs: true },
    faqs:     { title: 'S.S.S.',    note: 'Sık sorulan sorular ve cevapları.', langs: true },
    quotes:   { title: 'Yorumlar',  note: 'Misafir yorumları. Kaydırmalı bölümde döner.', langs: true },
    gallery:  { title: 'Galeri',    note: 'Galeri sayfasındaki ve ana sayfadaki fotoğraflar.', langs: false },
    media:    { title: 'Görseller', note: 'Hero videosu ve sayfadaki büyük görseller.', langs: false },
    contact:  { title: 'İletişim',  note: 'Adres, telefon, saatler, sosyal medya ve harita.', langs: false }
  };

  function bindTabs() {
    $$('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#tabs button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        tab = b.dataset.tab;
        render();
      });
    });
    $('#save').addEventListener('click', save);
  }

  function buildLangbar() {
    var bar = $('#langbar');
    bar.innerHTML = '';
    LANGS.forEach(function (l) {
      bar.appendChild(el('button', {
        type: 'button',
        class: l.code === lang ? 'on' : '',
        onclick: function () { lang = l.code; buildLangbar(); render(); }
      }, esc(l.short)));
    });
  }

  function render() {
    var meta = TABS[tab];
    $('#paneTitle').textContent = meta.title;
    $('#paneNote').textContent = meta.note;
    $('#langbar').classList.toggle('hidden', !meta.langs);
    $('#paneTools').innerHTML = '';

    var pane = $('#pane');
    pane.innerHTML = '';

    if (tab === 'texts')    renderTexts(pane);
    if (tab === 'services') renderServices(pane);
    if (tab === 'plans')    renderPlans(pane);
    if (tab === 'faqs')     renderList(pane, 'faqs', 'Soru', {
      question: { label: 'Soru',  type: 'input' },
      answer:   { label: 'Cevap', type: 'textarea' }
    });
    if (tab === 'quotes')   renderQuotes(pane);
    if (tab === 'gallery')  renderGallery(pane);
    if (tab === 'media')    renderMedia(pane);
    if (tab === 'contact')  renderContact(pane);
  }

  /* ---------------------------------------------------------------- 1. metinler */
  function renderTexts(pane) {
    var keys = DATA.content.map(function (c) { return c.key; }).sort();
    if (!keys.length) {
      pane.appendChild(el('div', { class: 'empty' },
        'Henüz içerik yok. <code>supabase/seed.sql</code> dosyasını çalıştırın.'));
      return;
    }

    var used = {};
    TEXT_GROUPS.forEach(function (g) {
      var mine = keys.filter(function (k) { return g.match.test(k) && !used[k]; });
      mine.forEach(function (k) { used[k] = true; });
      if (!mine.length) return;

      pane.appendChild(el('h3', { class: 'section-title' }, esc(g.title)));
      var card = el('div', { class: 'card' });
      mine.forEach(function (k) { card.appendChild(textField(k)); });
      pane.appendChild(card);
    });

    var rest = keys.filter(function (k) { return !used[k]; });
    if (rest.length) {
      pane.appendChild(el('h3', { class: 'section-title' }, 'Diğer'));
      var card = el('div', { class: 'card' });
      rest.forEach(function (k) { card.appendChild(textField(k)); });
      pane.appendChild(card);
    }
  }

  function textField(key) {
    var rec = contentRow(key);
    var val = (rec.value && rec.value[lang]) || '';
    var long = String(val).length > 90 || /\.(text|description)$/i.test(key);

    var f = el('div', { class: 'f' });
    f.appendChild(el('label', {}, esc(labelFor(key)) +
      ' <span class="hint">' + esc(key) + '</span>'));

    var input = el(long ? 'textarea' : 'input', {
      oninput: function () {
        if (!rec.value || typeof rec.value !== 'object') rec.value = {};
        rec.value[lang] = input.value;
        markDirty();
      }
    });
    if (!long) input.type = 'text';
    input.value = val;
    f.appendChild(input);
    return f;
  }

  /* ---------------------------------------------------------------- ortak kart araçları */
  function cardTools(listName, rec, redraw) {
    var tools = el('div', { class: 'tools' });

    var sw = el('label', { class: 'sw', title: 'Sitede göster' });
    var cb = el('input', { type: 'checkbox' });
    cb.checked = rec.is_active !== false;
    cb.addEventListener('change', function () { rec.is_active = cb.checked; markDirty(); redraw(); });
    sw.appendChild(cb);
    sw.appendChild(el('i'));
    tools.appendChild(sw);

    tools.appendChild(el('button', {
      class: 'b b--ghost b--icon', title: 'Yukarı taşı',
      onclick: function () { move(listName, rec, -1, redraw); }
    }, '↑'));
    tools.appendChild(el('button', {
      class: 'b b--ghost b--icon', title: 'Aşağı taşı',
      onclick: function () { move(listName, rec, 1, redraw); }
    }, '↓'));
    tools.appendChild(el('button', {
      class: 'b b--danger b--sm', title: 'Sil',
      onclick: function () {
        if (!confirm('Bu kayıt silinsin mi? Kaydet dediğinizde kalıcı olur.')) return;
        var list = DATA[listName];
        var i = list.indexOf(rec);
        if (i > -1) list.splice(i, 1);
        if (rec.id && !rec.__new) REMOVED[listName].push(rec.id);
        markDirty(); redraw();
      }
    }, 'Sil'));

    return tools;
  }

  function move(listName, rec, dir, redraw) {
    var list = DATA[listName];
    var i = list.indexOf(rec), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    list.forEach(function (r, k) { r.position = k; });
    markDirty(); redraw();
  }

  function addButton(label, onClick) {
    var b = el('button', { class: 'b', type: 'button', onclick: onClick }, '+ ' + esc(label));
    $('#paneTools').appendChild(b);
  }

  /* Çok dilli bir jsonb alan için giriş kutusu */
  function i18nField(rec, field, label, type) {
    var f = el('div', { class: 'f' });
    f.appendChild(el('label', {}, esc(label)));
    var input = el(type === 'textarea' ? 'textarea' : 'input', {
      oninput: function () {
        if (!rec[field] || typeof rec[field] !== 'object') rec[field] = {};
        rec[field][lang] = input.value;
        markDirty();
      }
    });
    if (type !== 'textarea') input.type = 'text';
    input.value = (rec[field] && rec[field][lang]) || '';
    f.appendChild(input);
    return f;
  }

  /* Düz metin alanı (dilden bağımsız) */
  function plainField(rec, field, label, hint, type) {
    var f = el('div', { class: 'f' });
    f.appendChild(el('label', {}, esc(label) + (hint ? ' <span class="hint">' + esc(hint) + '</span>' : '')));
    var input = el(type === 'textarea' ? 'textarea' : 'input', {
      oninput: function () { rec[field] = input.value; markDirty(); }
    });
    if (type !== 'textarea') input.type = 'text';
    input.value = rec[field] || '';
    f.appendChild(input);
    return f;
  }

  /* ---------------------------------------------------------------- 2. hizmetler */
  function renderServices(pane) {
    addButton('Hizmet ekle', function () {
      DATA.services.push({ id: uuid(), __new: true, slug: 'hizmet-' + (DATA.services.length + 1),
                           position: DATA.services.length, name: {}, description: {},
                           image_url: '', duration: '', price: '', is_active: true });
      markDirty(); render();
    });

    if (!DATA.services.length) {
      pane.appendChild(el('div', { class: 'empty' }, 'Henüz hizmet yok.'));
      return;
    }

    DATA.services.forEach(function (rec, i) {
      var card = el('div', { class: 'card' + (rec.is_active === false ? ' off' : '') });
      var top = el('div', { class: 'card__top' });
      top.appendChild(el('span', { class: 'card__num' }, String(i + 1)));
      top.appendChild(el('h3', {}, esc((rec.name && rec.name[lang]) || rec.slug || 'Yeni hizmet')));
      top.appendChild(cardTools('services', rec, render));
      card.appendChild(top);

      card.appendChild(i18nField(rec, 'name', 'Hizmet adı'));
      card.appendChild(i18nField(rec, 'description', 'Açıklama', 'textarea'));

      var g = el('div', { class: 'grid3' });
      g.appendChild(plainField(rec, 'duration', 'Süre', 'örn. 60 dk'));
      g.appendChild(plainField(rec, 'price', 'Fiyat', 'örn. ₺1.200'));
      g.appendChild(plainField(rec, 'slug', 'Kısa ad', 'benzersiz, boşluksuz'));
      card.appendChild(g);

      card.appendChild(imagePicker(rec, 'image_url', 'Kart görseli / illüstrasyonu'));
      pane.appendChild(card);
    });
  }

  /* ---------------------------------------------------------------- 3. paketler */
  function renderPlans(pane) {
    addButton('Paket ekle', function () {
      DATA.plans.push({ id: uuid(), __new: true, position: DATA.plans.length,
                        featured: false, price: '', per: '', name: {}, note: {},
                        items: {}, is_active: true });
      markDirty(); render();
    });

    if (!DATA.plans.length) { pane.appendChild(el('div', { class: 'empty' }, 'Henüz paket yok.')); return; }

    DATA.plans.forEach(function (rec, i) {
      var card = el('div', { class: 'card' + (rec.is_active === false ? ' off' : '') });
      var top = el('div', { class: 'card__top' });
      top.appendChild(el('span', { class: 'card__num' }, String(i + 1)));
      top.appendChild(el('h3', {}, esc((rec.name && rec.name[lang]) || 'Yeni paket')));
      top.appendChild(cardTools('plans', rec, render));
      card.appendChild(top);

      card.appendChild(i18nField(rec, 'name', 'Paket adı'));
      card.appendChild(i18nField(rec, 'note', 'Kısa açıklama', 'textarea'));

      var g = el('div', { class: 'grid3' });
      g.appendChild(plainField(rec, 'price', 'Fiyat', 'örn. ₺1.200'));
      g.appendChild(plainField(rec, 'per', 'Süre etiketi', 'örn. 90 dakika'));

      var ff = el('div', { class: 'f' });
      ff.appendChild(el('label', {}, 'Öne çıkar'));
      var sw = el('label', { class: 'sw', style: 'min-height:46px' });
      var cb = el('input', { type: 'checkbox' });
      cb.checked = !!rec.featured;
      cb.addEventListener('change', function () { rec.featured = cb.checked; markDirty(); });
      sw.appendChild(cb); sw.appendChild(el('i'));
      sw.appendChild(el('span', {}, 'yeşil kart olarak göster'));
      ff.appendChild(sw);
      g.appendChild(ff);
      card.appendChild(g);

      // madde listesi — her satır ayrı
      var f = el('div', { class: 'f' });
      f.appendChild(el('label', {}, 'Paket içeriği <span class="hint">her satır bir madde</span>'));
      var ta = el('textarea', { style: 'min-height:120px' });
      var arr = (rec.items && rec.items[lang]) || [];
      ta.value = Array.isArray(arr) ? arr.join('\n') : '';
      ta.addEventListener('input', function () {
        if (!rec.items || typeof rec.items !== 'object') rec.items = {};
        rec.items[lang] = ta.value.split('\n').map(function (s) { return s.trim(); })
                            .filter(function (s) { return s; });
        markDirty();
      });
      f.appendChild(ta);
      card.appendChild(f);

      pane.appendChild(card);
    });
  }

  /* ---------------------------------------------------------------- 4. genel liste (S.S.S.) */
  function renderList(pane, listName, noun, fields) {
    addButton(noun + ' ekle', function () {
      var rec = { id: uuid(), __new: true, position: DATA[listName].length, is_active: true };
      Object.keys(fields).forEach(function (f) { rec[f] = {}; });
      DATA[listName].push(rec);
      markDirty(); render();
    });

    if (!DATA[listName].length) {
      pane.appendChild(el('div', { class: 'empty' }, 'Henüz kayıt yok.'));
      return;
    }

    DATA[listName].forEach(function (rec, i) {
      var card = el('div', { class: 'card' + (rec.is_active === false ? ' off' : '') });
      var top = el('div', { class: 'card__top' });
      top.appendChild(el('span', { class: 'card__num' }, String(i + 1)));
      var firstField = Object.keys(fields)[0];
      top.appendChild(el('h3', {}, esc((rec[firstField] && rec[firstField][lang]) || ('Yeni ' + noun.toLowerCase()))));
      top.appendChild(cardTools(listName, rec, render));
      card.appendChild(top);

      Object.keys(fields).forEach(function (f) {
        card.appendChild(i18nField(rec, f, fields[f].label, fields[f].type));
      });
      pane.appendChild(card);
    });
  }

  /* ---------------------------------------------------------------- 5. yorumlar */
  function renderQuotes(pane) {
    addButton('Yorum ekle', function () {
      DATA.testimonials.push({ id: uuid(), __new: true, position: DATA.testimonials.length,
                               author: '', role: '', rating: 5, body: {}, is_active: true });
      markDirty(); render();
    });

    if (!DATA.testimonials.length) {
      pane.appendChild(el('div', { class: 'empty' }, 'Henüz yorum yok.'));
      return;
    }

    DATA.testimonials.forEach(function (rec, i) {
      var card = el('div', { class: 'card' + (rec.is_active === false ? ' off' : '') });
      var top = el('div', { class: 'card__top' });
      top.appendChild(el('span', { class: 'card__num' }, String(i + 1)));
      top.appendChild(el('h3', {}, esc(rec.author || 'Yeni yorum')));
      top.appendChild(cardTools('testimonials', rec, render));
      card.appendChild(top);

      card.appendChild(i18nField(rec, 'body', 'Yorum metni', 'textarea'));

      var g = el('div', { class: 'grid3' });
      g.appendChild(plainField(rec, 'author', 'İsim'));
      g.appendChild(plainField(rec, 'role', 'Alt bilgi', 'örn. Düzenli misafir'));

      var f = el('div', { class: 'f' });
      f.appendChild(el('label', {}, 'Yıldız'));
      var sel = el('select', {
        onchange: function () { rec.rating = parseInt(sel.value, 10); markDirty(); }
      });
      [5, 4, 3, 2, 1].forEach(function (n) {
        var o = el('option', { value: n }, n + ' yıldız');
        if ((rec.rating || 5) === n) o.selected = true;
        sel.appendChild(o);
      });
      f.appendChild(sel);
      g.appendChild(f);
      card.appendChild(g);

      pane.appendChild(card);
    });
  }

  /* ---------------------------------------------------------------- 6. galeri */
  function renderGallery(pane) {
    var CATS = [['space', 'Mekân'], ['treatments', 'Uygulamalar'], ['details', 'Detaylar']];

    var input = el('input', { type: 'file', accept: 'image/*', multiple: true, class: 'hidden' });
    input.addEventListener('change', function () {
      uploadMany(Array.prototype.slice.call(input.files));
      input.value = '';
    });
    pane.appendChild(input);
    addButton('Fotoğraf yükle', function () { input.click(); });

    var drop = el('div', { class: 'drop' },
      'Fotoğrafları buraya sürükleyin ya da tıklayıp seçin — birden fazla seçebilirsiniz');
    drop.addEventListener('click', function () { input.click(); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      var files = Array.prototype.slice.call(e.dataTransfer.files)
                    .filter(function (f) { return /^image\//.test(f.type); });
      if (files.length) uploadMany(files);
    });
    pane.appendChild(drop);

    function uploadMany(files) {
      if (!files.length) return;
      toast(files.length + ' dosya yükleniyor…');
      Promise.all(files.map(function (f) { return upload(f); })).then(function (urls) {
        urls.filter(Boolean).forEach(function (u) {
          DATA.gallery.push({ id: uuid(), __new: true, position: DATA.gallery.length,
                              image_url: u, category: 'details', caption: {}, is_active: true });
        });
        markDirty(); render();
        toast(urls.filter(Boolean).length + ' fotoğraf eklendi — kaydetmeyi unutmayın', 'ok');
      });
    }

    if (!DATA.gallery.length) {
      pane.appendChild(el('div', { class: 'empty' }, 'Galeride henüz fotoğraf yok.'));
      return;
    }

    var grid = el('div', { class: 'gal', style: 'margin-top:18px' });
    DATA.gallery.forEach(function (rec, i) {
      var fig = el('figure', { class: rec.is_active === false ? 'off' : '' });
      fig.appendChild(el('img', { src: rec.image_url, alt: '', loading: 'lazy' }));

      var cap = el('figcaption');
      var sel = el('select', {
        onchange: function () { rec.category = sel.value; markDirty(); }
      });
      CATS.forEach(function (c) {
        var o = el('option', { value: c[0] }, c[1]);
        if ((rec.category || 'details') === c[0]) o.selected = true;
        sel.appendChild(o);
      });
      cap.appendChild(sel);

      var r1 = el('div', { class: 'row' });
      r1.appendChild(el('button', { class: 'b b--ghost b--sm',
        onclick: function () { move('gallery', rec, -1, render); } }, '↑'));
      r1.appendChild(el('button', { class: 'b b--ghost b--sm',
        onclick: function () { move('gallery', rec, 1, render); } }, '↓'));
      r1.appendChild(el('button', { class: 'b b--danger b--sm', onclick: function () {
        if (!confirm('Bu fotoğraf galeriden çıkarılsın mı?')) return;
        DATA.gallery.splice(DATA.gallery.indexOf(rec), 1);
        if (rec.id && !rec.__new) REMOVED.gallery.push(rec.id);
        markDirty(); render();
      } }, 'Sil'));
      cap.appendChild(r1);

      fig.appendChild(cap);
      grid.appendChild(fig);
    });
    pane.appendChild(grid);
  }

  /* ---------------------------------------------------------------- 7. görseller */
  var MEDIA_FIELDS = [
    ['hero_video',   'Giriş videosu',        'Sessiz, döngüye uygun MP4. Büyük dosyalar yavaş açılır.', 'video'],
    ['hero_poster',  'Video kapak görseli',  'Video yüklenene kadar görünür.', 'image'],
    ['about_inline', 'Başlık içi görsel',    'Hakkımızda başlığının içine oval olarak yerleşir.', 'image'],
    ['about_1',      'Hakkımızda — sol',     '', 'image'],
    ['about_2',      'Hakkımızda — orta',    'Ortadaki daha uzun görünür, en güçlü kareyi buraya koyun.', 'image'],
    ['about_3',      'Hakkımızda — sağ',     '', 'image'],
    ['ambience',     'Ara bölüm görseli',    'Sayfanın ortasındaki geniş şerit.', 'image'],
    ['footer_bg',    'Alt bilgi arka planı', 'Koyu yeşilin altında soluk görünür.', 'image']
  ];

  function renderMedia(pane) {
    var card = el('div', { class: 'card' });
    MEDIA_FIELDS.forEach(function (m) {
      var rec = setting(m[0]);
      card.appendChild(imagePicker(rec, 'value', m[1], m[2], m[3]));
    });
    pane.appendChild(card);
  }

  function imagePicker(rec, field, label, hint, kind) {
    kind = kind || 'image';

    var f = el('div', { class: 'f' });
    f.appendChild(el('label', {}, esc(label) + (hint ? ' <span class="hint">' + esc(hint) + '</span>' : '')));

    var wrap = el('div', { class: 'pick' });
    var prev = el('div', { class: 'pick__prev' });
    var body = el('div', { class: 'pick__body' });

    var url = el('input', { type: 'text', placeholder: 'Adres ya da dosya yolu' });
    url.value = rec[field] || '';
    url.addEventListener('input', function () { rec[field] = url.value; paint(); markDirty(); });

    function paint() {
      var v = rec[field] || '';
      prev.innerHTML = '';
      prev.style.backgroundImage = '';
      if (!v) { prev.textContent = 'görsel yok'; return; }
      if (kind === 'video') {
        var vid = el('video', { src: v, muted: 'muted', playsinline: 'playsinline' });
        vid.muted = true;
        prev.appendChild(vid);
      } else {
        prev.style.backgroundImage = 'url("' + v.replace(/"/g, '%22') + '")';
      }
    }
    paint();

    var file = el('input', { type: 'file', class: 'hidden',
                             accept: kind === 'video' ? 'video/*' : 'image/*' });
    file.addEventListener('change', function () {
      var f0 = file.files[0];
      file.value = '';
      if (!f0) return;
      toast('Yükleniyor…');
      upload(f0).then(function (u) {
        if (!u) return;
        rec[field] = u; url.value = u; paint(); markDirty();
        toast('Yüklendi — kaydetmeyi unutmayın', 'ok');
      });
    });

    var row = el('div', { class: 'pick__row' });
    row.appendChild(el('button', { class: 'b b--sm', type: 'button',
      onclick: function () { file.click(); } }, kind === 'video' ? 'Video yükle' : 'Görsel yükle'));
    row.appendChild(el('button', { class: 'b b--ghost b--sm', type: 'button',
      onclick: function () { rec[field] = ''; url.value = ''; paint(); markDirty(); } }, 'Temizle'));

    body.appendChild(url);
    body.appendChild(row);
    body.appendChild(file);

    wrap.appendChild(prev);
    wrap.appendChild(body);
    f.appendChild(wrap);
    return f;
  }

  /* ---------------------------------------------------------------- 8. iletişim */
  var CONTACT_FIELDS = [
    ['Adres',            [['address_line1', 'Adres — 1. satır', ''],
                          ['address_line2', 'Adres — 2. satır', 'şehir, ülke']]],
    ['Telefon ve e-posta',[['phone_display', 'Telefon (görünen)', 'örn. +66 12 345 6789'],
                          ['phone',         'Telefon (arama için)', 'boşluksuz, örn. +66123456789'],
                          ['email_display', 'E-posta (görünen)', ''],
                          ['email',         'E-posta (bağlantı için)', '']]],
    ['Çalışma saatleri', [['hours_weekday', 'Hafta içi', 'örn. 10:00 – 22:00'],
                          ['hours_weekend', 'Hafta sonu', 'örn. 10:00 – 23:00']]],
    ['Sayaçlar',         [['stat1', '1. sayaç değeri', 'örn. 12'],
                          ['stat2', '2. sayaç değeri', 'örn. 8'],
                          ['stat3', '3. sayaç değeri', 'örn. 4.000+']]],
    ['Sosyal medya',     [['instagram',    'Instagram adresi', 'https://…'],
                          ['facebook',     'Facebook adresi', 'https://…'],
                          ['whatsapp_url', 'WhatsApp bağlantısı', 'https://wa.me/…']]]
  ];

  function renderContact(pane) {
    CONTACT_FIELDS.forEach(function (group) {
      pane.appendChild(el('h3', { class: 'section-title' }, esc(group[0])));
      var card = el('div', { class: 'card' });
      var g = el('div', { class: group[1].length > 2 ? 'grid2' : 'grid2' });
      group[1].forEach(function (fd) {
        g.appendChild(plainField(setting(fd[0]), 'value', fd[1], fd[2]));
      });
      card.appendChild(g);
      pane.appendChild(card);
    });

    pane.appendChild(el('h3', { class: 'section-title' }, 'Harita'));
    var card = el('div', { class: 'card' });
    card.appendChild(plainField(setting('map_embed'), 'value', 'Google Haritalar yerleştirme kodu',
      'Google Haritalar → Paylaş → Harita yerleştir → kopyalanan kodu buraya yapıştırın', 'textarea'));
    pane.appendChild(card);
  }

  /* ---------------------------------------------------------------- yükleme */
  function upload(file) {
    var clean = file.name.toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    var path = Date.now() + '-' + (clean || 'dosya');

    return sb.storage.from(BUCKET()).upload(path, file, { cacheControl: '3600', upsert: false })
      .then(function (r) {
        if (r.error) throw r.error;
        return sb.storage.from(BUCKET()).getPublicUrl(path).data.publicUrl;
      })
      .catch(function (err) {
        toast('Yüklenemedi: ' + errText(err), 'err');
        return null;
      });
  }

  /* ---------------------------------------------------------------- kaydet */
  function save() {
    var btn = $('#save');
    btn.disabled = true;
    $('#status').textContent = 'Kaydediliyor…';

    var jobs = [];

    // content
    if (DATA.content.length) {
      jobs.push(sb.from(T('content')).upsert(
        DATA.content.map(function (c) { return { key: c.key, value: c.value || {} }; }),
        { onConflict: 'key' }));
    }

    // settings
    if (DATA.settings.length) {
      jobs.push(sb.from(T('settings')).upsert(
        DATA.settings.map(function (s) { return { key: s.key, value: s.value || '' }; }),
        { onConflict: 'key' }));
    }

    // sıralı listeler
    var LISTS = {
      services:     ['id', 'slug', 'position', 'image_url', 'duration', 'price', 'name', 'description', 'is_active'],
      plans:        ['id', 'position', 'featured', 'price', 'per', 'name', 'note', 'items', 'is_active'],
      faqs:         ['id', 'position', 'question', 'answer', 'is_active'],
      testimonials: ['id', 'position', 'author', 'role', 'rating', 'body', 'is_active'],
      gallery:      ['id', 'position', 'image_url', 'category', 'caption', 'is_active']
    };

    Object.keys(LISTS).forEach(function (name) {
      var cols = LISTS[name];
      var rows = DATA[name].map(function (r, i) {
        var o = {};
        cols.forEach(function (c) {
          o[c] = (c === 'position') ? i : (r[c] === undefined ? null : r[c]);
        });
        if (o.is_active === null) o.is_active = true;
        return o;
      });
      if (rows.length) jobs.push(sb.from(T(name)).upsert(rows, { onConflict: 'id' }));
      if (REMOVED[name].length) jobs.push(sb.from(T(name)).delete().in('id', REMOVED[name]));
    });

    Promise.all(jobs).then(function (res) {
      var bad = res.filter(function (r) { return r && r.error; });
      if (bad.length) {
        toast('Kaydedilemedi: ' + bad[0].error.message, 'err');
        $('#status').textContent = 'Kaydedilemedi';
        btn.disabled = false;
        return;
      }
      Object.keys(REMOVED).forEach(function (k) { REMOVED[k] = []; });
      DATA.services.concat(DATA.plans, DATA.faqs, DATA.testimonials, DATA.gallery)
        .forEach(function (r) { delete r.__new; });
      clearDirty();
      toast('Kaydedildi. Site birkaç saniye içinde güncellenir.', 'ok');
    }).catch(function (err) {
      toast('Kaydedilemedi: ' + errText(err), 'err');
      $('#status').textContent = 'Kaydedilemedi';
      btn.disabled = false;
    });
  }

  /* ---------------------------------------------------------------- başlat */
  if (!window.supabase) {
    document.addEventListener('DOMContentLoaded', function () {
      $('#setupWarn').classList.remove('hidden');
      $('#setupWarn').innerHTML =
        '<h3>Supabase kütüphanesi yüklenemedi</h3>' +
        '<p>İnternet bağlantısını kontrol edip sayfayı yenileyin.</p>';
      $('#loginForm').classList.add('hidden');
    });
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
})();
