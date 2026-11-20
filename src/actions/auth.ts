'use server';

import { createClient } from '@/lib/db/server';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('app_role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: `Signed in, but couldn't load your account role: ${profileError.message}` };
  }

  if (profile?.app_role === 'admin') redirect('/admin');
  if (profile?.app_role === 'ops') redirect('/ops');
  if (profile?.app_role === 'crew') redirect('/crew');

  return {
    error: 'Your account is signed in, but it has no assigned app role. Ask an administrator to check your profile.',
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}