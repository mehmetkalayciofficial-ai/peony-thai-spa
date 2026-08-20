# Admin panel kurulumu

> **Kurulum tamamlandı (20 Ağustos 2026).** Panel çalışıyor:
> https://peony-thai-spa.vercel.app/admin.html
> Giriş bilgileri `~/peony-admin-bilgileri.txt` dosyasında (git deposunun dışında).
>
> Peony, ücretsiz plandaki 2 proje sınırı dolu olduğu için **hasburak-sarrafiye**
> projesinin veritabanını paylaşıyor. Tablolar `peony_` önekli, görseller ayrı
> `peony-media` kovasında; hasburak verisine erişim yok (RLS ile doğrulandı).
>
> Aşağıdaki adımlar yalnızca **sıfırdan yeni bir kurulum** yapılacaksa geçerlidir
> (örneğin Pro plana geçilip Peony kendi projesine taşınırsa).

Panel `admin.html` adresinde. Çalışması için bir Supabase projesi gerekiyor.
Aşağıdaki 5 adım bir kez yapılır, sonrası tarayıcıdan yönetilir.

---

## 1. Supabase projesi aç

[supabase.com](https://supabase.com) → **New project**

- **Name:** `peony-thai-spa`
- **Region:** Singapore (Tayland'a en yakın) — müşteriler Türkiye'deyse Frankfurt
- **Database password:** güçlü bir parola belirleyip **bir yere kaydedin**

Proje hazırlanması 1–2 dakika sürer.

## 2. Tabloları oluştur

Supabase panelinde **SQL Editor** → **New query** →
`supabase/schema.sql` dosyasının tamamını yapıştırın → **Run**.

Bu adım tabloları, güvenlik kurallarını ve görseller için `media` kovasını kurar.

## 3. Mevcut içeriği aktar

Yine **SQL Editor** → yeni sorgu → `supabase/seed.sql` dosyasının tamamını
yapıştırın → **Run**.

Sitedeki bütün metinler, 8 hizmet, 3 paket, 6 soru, 3 yorum ve 12 galeri
fotoğrafı 6 dilde birlikte panele aktarılır.

## 4. Yönetici hesabı oluştur

**Authentication** → **Users** → **Add user** → **Create new user**

- E-posta ve parola girin
- **Auto Confirm User** seçeneğini **işaretleyin** (yoksa doğrulama e-postası beklenir)

Panele bu e-posta ve parolayla girilecek.

## 5. Bağlantı bilgilerini siteye yaz

**Project Settings** → **API** sayfasından iki değeri kopyalayın:

- **Project URL**
- **Project API keys → `anon` `public`**

`js/supabase-config.js` dosyasını açıp doldurun:

```js
window.PEONY_SUPABASE = {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

Dosyayı kaydedip siteyi yeniden yayına alın. Panel artık hazır.

---

## Güvenlik notu

`anon` anahtarı tarayıcıya açıktır, bu normaldir — tek başına hiçbir şey
yazamaz. Yazma yetkisi yalnızca 4. adımda oluşturulan hesapla giriş yapan
oturuma verilir (satır düzeyi güvenlik kuralları `schema.sql` içinde).

**`service_role` anahtarını siteye asla koymayın.**

## Panel kapalıyken ne olur?

`supabase-config.js` boş bırakılırsa site, `i18n/*.json` dosyalarındaki sabit
içerikle sorunsuz çalışmaya devam eder. Panel yalnızca içeriği düzenlemek için
gereklidir; sitenin açılması ona bağlı değildir.

## Panelden neler değiştirilebilir?

| Sekme | Kapsam |
|---|---|
| **Metinler** | Sayfalardaki bütün sabit yazılar — 6 dil ayrı ayrı |
| **Hizmetler** | Kart ekle/sil/sırala, ad, açıklama, süre, fiyat, görsel |
| **Paketler** | Paket ekle/sil, fiyat, içerik maddeleri, öne çıkarma |
| **S.S.S.** | Soru-cevap ekle/sil/sırala |
| **Yorumlar** | Misafir yorumları, isim, yıldız |
| **Galeri** | Toplu fotoğraf yükleme, kategori, sıralama, silme |
| **Görseller** | Hero videosu, kapak görseli, hakkımızda ve ara bölüm görselleri |
| **İletişim** | Adres, telefon, e-posta, çalışma saatleri, sayaçlar, sosyal medya, harita |
