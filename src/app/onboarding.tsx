import { Text } from 'react-native';
import { GroupSetup } from '@/components/GroupSetup';
import { Hero } from '@/components/Hero';
import { Button, Screen } from '@/components/ui';
import { font } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function OnboardingScreen() {
  const { profile, signOut } = useAuth();
  return (
    <Screen>
      <Hero />
      <Text style={[font.body, { textAlign: 'center' }]}>
        Hallo {profile?.display_name ?? 'du'}! Treffen sind nur in deiner privaten Gruppe sichtbar. Tritt der Gruppe deiner
        Freunde bei oder gründe eine neue.
      </Text>
      <GroupSetup />
      <Button title="Abmelden" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
