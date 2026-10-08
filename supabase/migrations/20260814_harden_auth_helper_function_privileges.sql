-- Trigger and event-trigger helpers are internal database hooks, not RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- This function is referenced by RLS policies, so authenticated callers still
-- need execute permission while anonymous callers do not.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
