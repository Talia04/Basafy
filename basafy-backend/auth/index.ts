import { supabase } from '../supabase/client';

type SignUpParams = {
  email: string;
  password: string;
  fullName?: string;
};

type SignInParams = {
  email: string;
  password: string;
};

export async function signUpWithEmail({ email, password, fullName }: SignUpParams) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail({ email, password }: SignInParams) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sendPasswordResetEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
