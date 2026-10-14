-- Shisha Connect – initial schema
-- Private groups, bars, meetups with voting, RSVPs, in-app notifications and push tokens.
-- Every table is protected by row level security: members only ever see data of their own groups.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  notifications_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Create the profile automatically on sign up (name comes from the sign up metadata).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Gast'), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One user can have several devices.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  invite_code text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create function public.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- Easy to type codes: no 0/O/1/I.
create function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bars (shared within a group: bars picked from OpenStreetMap and manually added ones)
-- ---------------------------------------------------------------------------
create table public.bars (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  external_id text,
  name text not null check (char_length(name) between 1 and 80),
  address text,
  lat double precision,
  lng double precision,
  opening_hours text,
  website text,
  phone text,
  source text not null default 'manual' check (source in ('osm', 'manual', 'sample')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, external_id)
);

-- Personal favourites, stored as a snapshot so they work across groups.
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  bar_key text not null,
  bar jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, bar_key)
);

-- ---------------------------------------------------------------------------
-- Meetups
-- ---------------------------------------------------------------------------
create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 280),
  -- voting: several options proposed, creator still has to pick one
  -- confirmed: bar_id and starts_at are set
  -- cancelled: called off by the creator
  status text not null default 'confirmed' check (status in ('voting', 'confirmed', 'cancelled')),
  bar_id uuid references public.bars (id) on delete set null,
  starts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'confirmed' or starts_at is not null)
);
create index meetups_group_idx on public.meetups (group_id, starts_at);

create table public.meetup_options (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  bar_id uuid not null references public.bars (id) on delete cascade,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index meetup_options_meetup_idx on public.meetup_options (meetup_id);

create table public.option_votes (
  option_id uuid not null references public.meetup_options (id) on delete cascade,
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id)
);
create index option_votes_meetup_idx on public.option_votes (meetup_id);

create table public.rsvps (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  reminder_sent_at timestamptz,
  primary key (meetup_id, user_id)
);

-- In-app notification inbox. Filled by the edge functions for every recipient,
-- independent of whether push notifications are allowed on the device.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  meetup_id uuid references public.meetups (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Keep updated_at current and re-arm reminders when the start time moves.
create function public.meetups_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.starts_at is distinct from old.starts_at then
    update public.rsvps set reminder_sent_at = null where meetup_id = new.id;
  end if;
  return new;
end;
$$;

create trigger meetups_before_update
  before update on public.meetups
  for each row execute function public.meetups_before_update();

-- Only the creator may change who/where/when; group and creator can never change.
create function public.meetups_guard_update()
returns trigger
language plpgsql
as $$
begin
  if new.group_id <> old.group_id or new.created_by <> old.created_by then
    raise exception 'group_id and created_by cannot be changed';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Ein abgesagtes Treffen kann nicht reaktiviert werden';
  end if;
  return new;
end;
$$;

create trigger meetups_guard_update
  before update on public.meetups
  for each row execute function public.meetups_guard_update();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.bars enable row level security;
alter table public.favorites enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_options enable row level security;
alter table public.option_votes enable row level security;
alter table public.rsvps enable row level security;
alter table public.notifications enable row level security;

create policy "profiles: read own and group mates" on public.profiles
  for select using (id = auth.uid() or public.shares_group_with(id));
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "push_tokens: own" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "groups: members read" on public.groups
  for select using (public.is_group_member(id));
create policy "groups: admins update" on public.groups
  for update using (exists (
    select 1 from public.group_members m
    where m.group_id = id and m.user_id = auth.uid() and m.role = 'admin'
  ));

create policy "group_members: members read" on public.group_members
  for select using (public.is_group_member(group_id));
create policy "group_members: leave" on public.group_members
  for delete using (user_id = auth.uid());

create policy "bars: members read" on public.bars
  for select using (public.is_group_member(group_id));
create policy "bars: members add" on public.bars
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "bars: creator edits" on public.bars
  for update using (created_by = auth.uid());
create policy "bars: creator deletes" on public.bars
  for delete using (created_by = auth.uid() and source = 'manual');

create policy "favorites: own" on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "meetups: members read" on public.meetups
  for select using (public.is_group_member(group_id));
create policy "meetups: creator updates" on public.meetups
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "meetups: creator deletes" on public.meetups
  for delete using (created_by = auth.uid());
-- Inserts go through create_meetup() so options and the creator's RSVP are written atomically.

create policy "meetup_options: members read" on public.meetup_options
  for select using (exists (
    select 1 from public.meetups m where m.id = meetup_id and public.is_group_member(m.group_id)
  ));

create policy "option_votes: members read" on public.option_votes
  for select using (exists (
    select 1 from public.meetups m where m.id = meetup_id and public.is_group_member(m.group_id)
  ));
create policy "option_votes: vote" on public.option_votes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.meetups m
      join public.meetup_options o on o.meetup_id = m.id
      where m.id = meetup_id and o.id = option_id
        and m.status = 'voting' and public.is_group_member(m.group_id)
    )
  );
create policy "option_votes: unvote" on public.option_votes
  for delete using (user_id = auth.uid());

create policy "rsvps: members read" on public.rsvps
  for select using (exists (
    select 1 from public.meetups m where m.id = meetup_id and public.is_group_member(m.group_id)
  ));
create policy "rsvps: answer" on public.rsvps
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.meetups m
      where m.id = meetup_id and m.status <> 'cancelled' and public.is_group_member(m.group_id)
    )
  );
create policy "rsvps: change answer" on public.rsvps
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications: own read" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: own delete" on public.notifications
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  insert into public.groups (name, invite_code, created_by)
  values (trim(p_name), public.generate_invite_code(), auth.uid())
  returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, auth.uid(), 'admin');
  return g;
end;
$$;

create function public.join_group(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  select * into g from public.groups where invite_code = upper(trim(p_code));
  if g.id is null then
    raise exception 'Unbekannter Gruppencode';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid())
  on conflict do nothing;
  return g;
end;
$$;

create function public.regenerate_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Nur Admins können den Code erneuern';
  end if;
  code := public.generate_invite_code();
  update public.groups set invite_code = code where id = p_group_id;
  return code;
end;
$$;

-- Registers this device for push. Re-assigns the token if another account used the device before.
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- Returns the id of the bar inside the group, creating/refreshing it as needed.
-- p_bar: { id?, external_id?, name, address?, lat?, lng?, opening_hours?, website?, phone?, source? }
create function public.ensure_bar(p_group_id uuid, p_bar jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ext text := nullif(p_bar ->> 'external_id', '');
  v_source text := coalesce(nullif(p_bar ->> 'source', ''), 'manual');
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Kein Mitglied dieser Gruppe';
  end if;

  if nullif(p_bar ->> 'id', '') is not null then
    select id into v_id from public.bars
    where id = (p_bar ->> 'id')::uuid and group_id = p_group_id;
    if v_id is not null then
      return v_id;
    end if;
    -- A manual bar of another group: copy it into this group.
    v_ext := coalesce(v_ext, 'bar:' || (p_bar ->> 'id'));
  end if;

  if v_source not in ('osm', 'manual', 'sample') then
    v_source := 'manual';
  end if;

  if v_ext is not null then
    insert into public.bars (group_id, external_id, name, address, lat, lng, opening_hours, website, phone, source, created_by)
    values (
      p_group_id, v_ext, p_bar ->> 'name', p_bar ->> 'address',
      (p_bar ->> 'lat')::double precision, (p_bar ->> 'lng')::double precision,
      p_bar ->> 'opening_hours', p_bar ->> 'website', p_bar ->> 'phone', v_source, auth.uid()
    )
    on conflict (group_id, external_id) do update
      set name = excluded.name,
          address = coalesce(excluded.address, bars.address),
          lat = coalesce(excluded.lat, bars.lat),
          lng = coalesce(excluded.lng, bars.lng),
          opening_hours = coalesce(excluded.opening_hours, bars.opening_hours),
          website = coalesce(excluded.website, bars.website),
          phone = coalesce(excluded.phone, bars.phone)
    returning id into v_id;
  else
    insert into public.bars (group_id, name, address, lat, lng, opening_hours, website, phone, source, created_by)
    values (
      p_group_id, p_bar ->> 'name', p_bar ->> 'address',
      (p_bar ->> 'lat')::double precision, (p_bar ->> 'lng')::double precision,
      p_bar ->> 'opening_hours', p_bar ->> 'website', p_bar ->> 'phone', v_source, auth.uid()
    )
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Creates a meetup. One bar and one time → confirmed right away.
-- Several bars and/or times → every combination becomes a voting option.
create function public.create_meetup(
  p_group_id uuid,
  p_message text,
  p_bars jsonb,
  p_times timestamptz[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meetup_id uuid;
  v_bar_ids uuid[] := '{}';
  v_bar jsonb;
  v_bar_id uuid;
  v_time timestamptz;
  v_count int;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Kein Mitglied dieser Gruppe';
  end if;
  if jsonb_typeof(p_bars) <> 'array' or jsonb_array_length(p_bars) = 0 then
    raise exception 'Bitte mindestens eine Bar wählen';
  end if;
  if coalesce(array_length(p_times, 1), 0) = 0 then
    raise exception 'Bitte mindestens eine Uhrzeit wählen';
  end if;

  for v_bar in select * from jsonb_array_elements(p_bars) loop
    v_bar_ids := v_bar_ids || public.ensure_bar(p_group_id, v_bar);
  end loop;

  v_count := array_length(v_bar_ids, 1) * array_length(p_times, 1);
  if v_count > 12 then
    raise exception 'Maximal 12 Optionen pro Abstimmung';
  end if;

  if v_count = 1 then
    insert into public.meetups (group_id, created_by, message, status, bar_id, starts_at)
    values (p_group_id, auth.uid(), nullif(trim(p_message), ''), 'confirmed', v_bar_ids[1], p_times[1])
    returning id into v_meetup_id;
  else
    insert into public.meetups (group_id, created_by, message, status)
    values (p_group_id, auth.uid(), nullif(trim(p_message), ''), 'voting')
    returning id into v_meetup_id;
    foreach v_bar_id in array v_bar_ids loop
      foreach v_time in array p_times loop
        insert into public.meetup_options (meetup_id, bar_id, starts_at)
        values (v_meetup_id, v_bar_id, v_time);
      end loop;
    end loop;
  end if;

  insert into public.rsvps (meetup_id, user_id, status) values (v_meetup_id, auth.uid(), 'yes');
  return v_meetup_id;
end;
$$;

-- Creator changes bar and/or time of a confirmed meetup.
create function public.update_meetup(
  p_meetup_id uuid,
  p_bar jsonb,
  p_starts_at timestamptz,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.meetups;
  v_bar_id uuid;
begin
  select * into m from public.meetups where id = p_meetup_id;
  if m.id is null or m.created_by <> auth.uid() then
    raise exception 'Nur der Ersteller kann das Treffen bearbeiten';
  end if;
  if m.status = 'cancelled' then
    raise exception 'Das Treffen wurde abgesagt';
  end if;
  v_bar_id := case when p_bar is null then m.bar_id else public.ensure_bar(m.group_id, p_bar) end;
  update public.meetups
     set bar_id = v_bar_id,
         starts_at = coalesce(p_starts_at, starts_at),
         message = nullif(trim(p_message), ''),
         status = 'confirmed'
   where id = p_meetup_id;
end;
$$;

-- Creator picks the winning option of a vote.
create function public.confirm_option(p_meetup_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.meetups;
  o public.meetup_options;
begin
  select * into m from public.meetups where id = p_meetup_id;
  if m.id is null or m.created_by <> auth.uid() then
    raise exception 'Nur der Ersteller kann die Auswahl bestätigen';
  end if;
  select * into o from public.meetup_options where id = p_option_id and meetup_id = p_meetup_id;
  if o.id is null then
    raise exception 'Option nicht gefunden';
  end if;
  update public.meetups
     set status = 'confirmed', bar_id = o.bar_id, starts_at = o.starts_at
   where id = p_meetup_id;
end;
$$;

-- Used by the send-reminders edge function (service role only):
-- atomically claims all RSVPs that are due for the "1 hour before" reminder.
create function public.claim_due_reminders()
returns table (user_id uuid, meetup_id uuid, starts_at timestamptz, bar_name text)
language sql
security definer
set search_path = public
as $$
  update public.rsvps r
     set reminder_sent_at = now()
    from public.meetups m
    join public.profiles p on true
    left join public.bars b on b.id = m.bar_id
   where r.meetup_id = m.id
     and p.id = r.user_id
     and m.status = 'confirmed'
     and m.starts_at > now()
     and m.starts_at <= now() + interval '60 minutes'
     and r.status in ('yes', 'maybe')
     and r.reminder_sent_at is null
     and p.reminders_enabled
  returning r.user_id, r.meetup_id, m.starts_at, b.name;
$$;

revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;
revoke execute on function public.generate_invite_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: votes and RSVPs update live for all members
-- ---------------------------------------------------------------------------
alter table public.rsvps replica identity full;
alter table public.option_votes replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.meetups, public.meetup_options, public.option_votes, public.rsvps, public.notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: profile pictures (public read, users write into their own folder)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true)
    on conflict (id) do nothing;

    create policy "avatars: public read" on storage.objects
      for select using (bucket_id = 'avatars');
    create policy "avatars: upload own" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
    create policy "avatars: update own" on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
    create policy "avatars: delete own" on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end;
$$;
