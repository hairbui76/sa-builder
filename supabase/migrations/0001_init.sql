-- SA Builder: accounts, server-verified runs and leaderboard.
-- Runs are inserted only by the server (service role) after it re-evaluates the design,
-- so players cannot write their own scores.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  show_on_leaderboard boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  level_id text not null,
  evaluation_id text not null,
  passed boolean not null,
  stars smallint not null check (stars between 0 and 3),
  overall smallint not null check (overall between 0 and 100),
  monthly_usd numeric not null,
  tco3y_usd numeric not null,
  design jsonb not null,
  created_at timestamptz not null default now()
);
create index runs_user_level_idx on public.runs (user_id, level_id);
create index runs_created_idx on public.runs (created_at);

create table public.level_progress (
  user_id uuid not null references auth.users on delete cascade,
  level_id text not null,
  best_stars smallint not null default 0,
  best_overall smallint not null default 0,
  runs integer not null default 0,
  first_passed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

-- Keep per-level bests in step with every recorded run.
create function public.on_run_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.level_progress (user_id, level_id, best_stars, best_overall, runs, first_passed_at)
  values (new.user_id, new.level_id, new.stars, new.overall, 1, case when new.passed then new.created_at end)
  on conflict (user_id, level_id) do update set
    best_stars = greatest(level_progress.best_stars, excluded.best_stars),
    best_overall = greatest(level_progress.best_overall, excluded.best_overall),
    runs = level_progress.runs + 1,
    first_passed_at = coalesce(level_progress.first_passed_at, excluded.first_passed_at),
    updated_at = now();
  return new;
end $$;

create trigger runs_after_insert after insert on public.runs
for each row execute function public.on_run_inserted();

-- A profile for every new account. Never derive the public name from the email address:
-- use the GitHub handle when there is one, otherwise an anonymous name.
create function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'user_name', ''), 'Kiến trúc sư ' || left(new.id::text, 6)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.on_auth_user_created();

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.level_progress enable row level security;

-- Profiles are private; the leaderboard function below exposes only names of players who opted in.
create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "read own runs" on public.runs for select using (auth.uid() = user_id);
create policy "read own progress" on public.level_progress for select using (auth.uid() = user_id);

-- Leaderboard: 10 points per star, 20 per level passed, over this week or all time.
create function public.leaderboard(p_window text default 'week')
returns table (display_name text, levels_passed int, stars int, points int, avg_runs numeric)
language sql stable security definer set search_path = public as $$
  with best as (
    select user_id, level_id, max(stars) as stars, bool_or(passed) as passed, count(*) as runs
    from public.runs
    where p_window = 'all' or created_at >= date_trunc('week', now())
    group by user_id, level_id
  )
  select p.display_name,
         (count(*) filter (where b.passed))::int,
         sum(b.stars)::int,
         (sum(b.stars) * 10 + count(*) filter (where b.passed) * 20)::int,
         round(avg(b.runs), 1)
  from best b
  join public.profiles p on p.id = b.user_id
  where p.show_on_leaderboard
  group by b.user_id, p.display_name
  order by 4 desc, 3 desc, 1
  limit 50
$$;

grant execute on function public.leaderboard(text) to anon, authenticated;
