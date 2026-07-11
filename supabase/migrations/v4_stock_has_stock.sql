-- Add has_stock flag to stock_checks
alter table public.stock_checks
  add column if not exists has_stock boolean not null default true;
