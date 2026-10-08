-- Migration: Add map_coords column to public.zones
alter table public.zones add column if not exists map_coords text;
