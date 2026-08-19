/* ==========================================================================
   Peony — Supabase bağlantı ayarları

   Bu iki değeri Supabase panelinden alın:
     Project Settings → API → Project URL  ve  Project API keys → anon public

   Boş bırakılırsa site, i18n/*.json dosyalarındaki sabit içerikle çalışmaya
   devam eder — hiçbir şey bozulmaz, sadece admin panelden yönetilemez.
   ========================================================================== */
window.PEONY_SUPABASE = {
  url: '',
  anonKey: ''
};
