/* ==========================================================================
   Peony — Supabase bağlantı ayarları

   Peony, hasburak projesinin veritabanını paylaşıyor (ücretsiz planda
   organizasyon başına 2 proje sınırı dolu olduğu için). Karışmaması adına
   Peony'nin tabloları "peony_" önekiyle, görselleri de ayrı bir depolama
   kovasında duruyor. İleride Peony kendi projesine taşınırsa yalnızca
   aşağıdaki değerler değişir, kodda başka hiçbir yere dokunmak gerekmez.

   Boş bırakılırsa site, i18n/*.json dosyalarındaki sabit içerikle çalışmaya
   devam eder — hiçbir şey bozulmaz, sadece admin panelden yönetilemez.
   ========================================================================== */
window.PEONY_SUPABASE = {
  url: 'https://maufckzgnutryoajhsjo.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdWZja3pnbnV0cnlvYWpoc2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODAwOTUsImV4cCI6MjEwMjY1NjA5NX0.7P_0anTl4exeb2UX0vEGft9tInrlC_ohPd2BDndp62Y',
  tablePrefix: 'peony_',
  bucket: 'peony-media'
};
