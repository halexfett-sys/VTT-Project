-- Run after 001_vtt.sql. Private transfer chunks and shared request limits.
begin;
create table if not exists public.vtt_transfers (
 id uuid primary key, guest_id uuid not null references public.vtt_guests(id),
 size bigint not null check(size between 1 and 134217728), name text not null,
 type text not null check(type in ('image','save')), expires_at timestamptz not null
);
create table if not exists public.vtt_rate_counters(key text primary key,window_start timestamptz not null,hits integer not null);
alter table public.vtt_transfers enable row level security;
alter table public.vtt_rate_counters enable row level security;
revoke all on public.vtt_transfers,public.vtt_rate_counters from anon,authenticated;
grant all on public.vtt_transfers,public.vtt_rate_counters to service_role;
create or replace function public.vtt_rate_limit(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare n integer;
begin
 insert into public.vtt_rate_counters(key,window_start,hits) values(p_key,now(),1)
 on conflict(key) do update set
 hits=case when vtt_rate_counters.window_start < now()-interval '1 minute' then 1 else vtt_rate_counters.hits+1 end,
 window_start=case when vtt_rate_counters.window_start < now()-interval '1 minute' then now() else vtt_rate_counters.window_start end
 returning hits into n;
 return n<=p_limit;
end;$$;
revoke all on function public.vtt_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.vtt_rate_limit(text,integer) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vtt-transfers','vtt-transfers',false,2097152,array['application/octet-stream']) on conflict(id) do nothing;
commit;
