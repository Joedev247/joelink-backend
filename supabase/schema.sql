-- JoeLink Supabase schema
-- Run this in the Supabase SQL Editor.

create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null default 'customer',
  password text,
  wallet_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  price numeric not null default 0,
  description text not null default '',
  category text not null default 'General',
  image text not null default '',
  stock integer not null default 0,
  featured boolean not null default false,
  credentials jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  user_id text not null,
  product_id text not null,
  amount numeric not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id text primary key,
  user_id text not null,
  type text not null,
  amount numeric not null default 0,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null default 'all',
  type text not null default 'info',
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users (email);
create index if not exists idx_orders_user_id on public.orders (user_id);
create index if not exists idx_wallet_transactions_user_id on public.wallet_transactions (user_id);
create index if not exists idx_notifications_user_id on public.notifications (user_id);

-- Optional seed rows for a quick start.
insert into public.users (id, name, email, role, password, wallet_balance, created_at)
values
  ('user_1', 'Admin', 'admin@joelink.test', 'admin', '$2a$12$0yONb4eB7yeo63G3FjQ9e.8aXvM1v9K4k2i9s1M2THf7V2p8XcW6K', 2500, now()),
  ('user_2', 'Customer', 'customer@joelink.test', 'customer', '$2a$12$A4K2mAoQJ0pZLWwMhx1v/.5wO4R6vdnq13cg2YVpJd1uPYm7g0lO6', 0, now())
on conflict (id) do nothing;

insert into public.products (id, name, price, description, category, image, stock, featured, credentials, created_at)
values
  ('1', 'Smartphone X', 799, 'Flagship device with premium camera and storage.', 'Phones', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80', 24, true, '{"username":"demo","password":"demo123"}', now()),
  ('2', 'Wireless Headset', 199, 'Immersive sound and active noise cancellation.', 'Audio', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80', 18, true, '{"username":"audio","password":"demo123"}', now())
on conflict (id) do nothing;
