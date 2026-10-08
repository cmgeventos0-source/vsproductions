-- ============================================================
-- Asignar rol ADMIN a un usuario existente
-- Reemplaza el email por el tuyo antes de ejecutar
-- ============================================================

-- Inserta el perfil si por alguna razón no existe (el trigger lo crea al registrarse)
insert into public.profiles (id, name, role)
select id, coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1)), 'admin'
from auth.users
where email = 'TU_EMAIL@aqui.com'
on conflict (id) do nothing;

-- Asigna el rol admin
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'TU_EMAIL@aqui.com'
);

-- Verifica el resultado:
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'admin';
