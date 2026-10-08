-- `is_admin` only reads the caller's own profile, which existing RLS permits.
-- It therefore does not need SECURITY DEFINER privileges.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;
