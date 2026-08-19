-- =====================================================================
-- Peony Thai Massage & Spa — içerik yönetimi şeması
-- Supabase → SQL Editor → yapıştır → Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Serbest metinler (i18n anahtarlarıyla birebir aynı)
--    value örneği: {"tr":"Peony ile...","en":"Traditional Thai..."}
-- ---------------------------------------------------------------------
create table if not exists content (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Hizmetler
-- ---------------------------------------------------------------------
create table if not exists services (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  position    int  not null default 0,
  image_url   text,
  duration    text,
  price       text,
  name        jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Paketler
-- ---------------------------------------------------------------------
create table if not exists plans (
  id         uuid primary key default gen_random_uuid(),
  position   int not null default 0,
  featured   boolean not null default false,
  price      text,
  per        text,
  name       jsonb not null default '{}'::jsonb,
  note       jsonb not null default '{}'::jsonb,
  items      jsonb not null default '{}'::jsonb,   -- {"tr":["...","..."]}
  is_active  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Sık sorulan sorular
-- ---------------------------------------------------------------------
create table if not exists faqs (
  id         uuid primary key default gen_random_uuid(),
  position   int not null default 0,
  question   jsonb not null default '{}'::jsonb,
  answer     jsonb not null default '{}'::jsonb,
  is_active  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Misafir yorumları
-- ---------------------------------------------------------------------
create table if not exists testimonials (
  id         uuid primary key default gen_random_uuid(),
  position   int not null default 0,
  author     text,
  role       text,
  rating     int not null default 5,
  body       jsonb not null default '{}'::jsonb,
  is_active  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Galeri
-- ---------------------------------------------------------------------
create table if not exists gallery (
  id         uuid primary key default gen_random_uuid(),
  position   int not null default 0,
  image_url  text not null,
  category   text not null default 'details',   -- space | treatments | details
  caption    jsonb not null default '{}'::jsonb,
  is_active  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Ayarlar — iletişim bilgileri, çalışma saatleri, medya adresleri
-- ---------------------------------------------------------------------
create table if not exists settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Güvenlik: herkes okur, sadece giriş yapmış yönetici yazar
-- ---------------------------------------------------------------------
alter table content      enable row level security;
alter table services     enable row level security;
alter table plans        enable row level security;
alter table faqs         enable row level security;
alter table testimonials enable row level security;
alter table gallery      enable row level security;
alter table settings     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['content','services','plans','faqs','testimonials','gallery','settings']
  loop
    execute format('drop policy if exists "public read %1$s" on %1$I', t);
    execute format('create policy "public read %1$s" on %1$I for select using (true)', t);

    execute format('drop policy if exists "admin write %1$s" on %1$I', t);
    execute format($f$create policy "admin write %1$s" on %1$I
                     for all to authenticated using (true) with check (true)$f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- updated_at otomatik güncelleme
-- ---------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['content','services','plans','faqs','testimonials','gallery','settings']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$I', t);
    execute format('create trigger trg_touch_%1$s before update on %1$I
                    for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Görseller için depolama alanı (herkes okur, yönetici yazar)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media public read"  on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media admin write"  on storage.objects;
create policy "media admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "media admin update" on storage.objects;
create policy "media admin update" on storage.objects
  for update to authenticated using (bucket_id = 'media');

drop policy if exists "media admin delete" on storage.objects;
create policy "media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
