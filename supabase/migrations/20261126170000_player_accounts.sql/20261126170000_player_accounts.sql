create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[a-zA-Z0-9_-]{3,24}$'),
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

create unique index profiles_username_lower_unique on public.profiles (lower(username));

create table public.match_records (
  account_id uuid primary key references public.profiles (id) on delete cascade,
  wins bigint not null default 0 check (wins >= 0),
  losses bigint not null default 0 check (losses >= 0),
  tied_rounds bigint not null default 0 check (tied_rounds >= 0),
  player_round_wins bigint not null default 0 check (player_round_wins >= 0),
  computer_round_wins bigint not null default 0 check (computer_round_wins >= 0),
  updated_at timestamptz not null default now()
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.match_records enable row level security;

create policy "Profiles readable by account owner or admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Account owners and admins can read match records"
on public.match_records for select to authenticated
using (account_id = (select auth.uid()) or (select public.is_admin()));

create policy "Account owners can insert match records"
on public.match_records for insert to authenticated
with check (account_id = (select auth.uid()));

create policy "Account owners can update match records"
on public.match_records for update to authenticated
using (account_id = (select auth.uid()))
with check (account_id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant select, insert, update on public.match_records to authenticated;

create function public.create_player_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_username text := lower(new.raw_user_meta_data ->> 'username');
begin
  if account_username is null
    or account_username !~ '^[a-zA-Z0-9_-]{3,24}$' then
    raise exception 'A valid username is required.';
  end if;

  insert into public.profiles (id, username)
  values (new.id, account_username);

  insert into public.match_records (account_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created_player_profile
after insert on auth.users
for each row execute function public.create_player_profile();
