import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Hero } from '@/components/Hero';
import { Button, Field, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('Anmeldung fehlgeschlagen', error.message);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
        <Hero />
        <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        <Button title="Anmelden" onPress={login} loading={busy} disabled={!email || !password} />
        <Link href="/register" asChild>
          <Button title="Neu hier? Konto erstellen" variant="ghost" />
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}
