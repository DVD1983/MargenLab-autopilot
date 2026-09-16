-- MargenLab Autopilot - esquema de almacenamiento en PostgreSQL (Supabase)
-- Ejecutar una sola vez en el SQL Editor de Supabase.

create table if not exists public.tiendas (
  id            bigint generated always as identity primary key,
  cliente       text not null unique,
  origen        text not null default 'csv',
  upload_name   text,
  upload_base64 text,
  clean         jsonb not null,
  hallazgos     jsonb not null,
  finanzas      jsonb not null,
  updated_at    timestamptz not null default now()
);

create index if not exists tiendas_cliente_idx on public.tiendas (cliente);

-- Nota: la app conecta con DATABASE_URL (connection string de Supabase).
-- Si usás el panel de Vercel, la variable se llama DATABASE_URL.