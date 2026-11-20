import { createClient } from '@/lib/db/server';
import { getCurrentProfile } from '@/lib/planning';

type Role = 'admin' | 'ops' | 'crew';

/**
 * Server actions are public POST endpoints, so each one checks the caller's
 * role itself instead of trusting that the button was only shown to them.
 */
export async function withRole(roles: Role[]) {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || !roles.includes(profile.app_role)) {
    throw new Error('You do not have permission to do this.');
  }
  return { supabase, profile };
}
