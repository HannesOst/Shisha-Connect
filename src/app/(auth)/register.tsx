import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Field, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Hero } from '@/components/Hero';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const register = async () => {
    if (password.length < 8) {
      Alert.alert('Passwort zu kurz', 'Bitte mindestens 8 Zeichen verwenden.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setBusy(false);
    if (error) {
      Alert.alert('Registrierung fehlgeschlagen', error.message);
    } else if (!data.session) {
      Alert.alert('Fast geschafft', 'Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach und melde dich dann an.');
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
        <Hero />
        <Field label="Dein Name" value={name} onChangeText={setName} placeholder="z. B. Hannes" autoComplete="name" maxLength={40} />
        <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Passwort (mind. 8 Zeichen)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <Button title="Konto erstellen" onPress={register} loading={busy} disabled={!name.trim() || !email || !password} />
        <Button title="Ich habe schon ein Konto" variant="ghost" onPress={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
