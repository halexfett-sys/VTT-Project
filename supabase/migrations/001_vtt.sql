-- Dedicated names avoid collisions with unrelated Supabase project tables.
begin;
create table if not exists public.vtt_guests (
  id uuid primary key,
  name text not null
);
create table if not exists public.vtt_sessions (
  token_hash text primary key,
  guest_id uuid not null references public.vtt_guests(id),
  expires_at timestamptz not null
);
create table if not exists public.vtt_campaigns (
  id uuid primary key,
  invite text unique not null,
  revision bigint not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.vtt_save_keys (
  campaign_id uuid not null references public.vtt_campaigns(id),
  guest_id uuid not null references public.vtt_guests(id),
  key_hash text not null,
  primary key(campaign_id,key_hash)
);
alter table public.vtt_guests enable row level security;
alter table public.vtt_sessions enable row level security;
alter table public.vtt_campaigns enable row level security;
alter table public.vtt_save_keys enable row level security;
revoke all on public.vtt_guests,public.vtt_sessions,public.vtt_campaigns,public.vtt_save_keys from anon,authenticated;
grant all on public.vtt_guests,public.vtt_sessions,public.vtt_campaigns,public.vtt_save_keys to service_role;

create or replace function public.vtt_commit_campaign(p_id uuid,p_expected bigint,p_state jsonb)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  if (p_state->>'id')::uuid <> p_id or (p_state->>'revision')::bigint <> coalesce(p_expected,0)+1 then
    raise exception 'Invalid campaign revision';
  end if;
  if p_expected is null then
    insert into public.vtt_campaigns(id,invite,revision,state)
      values(p_id,p_state->>'invite',1,p_state) on conflict(id) do nothing;
  else
    update public.vtt_campaigns set state=p_state,revision=p_expected+1,updated_at=now()
      where id=p_id and revision=p_expected;
  end if;
  return found;
end;
$$;
revoke all on function public.vtt_commit_campaign(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.vtt_commit_campaign(uuid,bigint,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vtt-assets','vtt-assets',false,20971520,array['image/webp'])
on conflict(id) do nothing;
commit;
