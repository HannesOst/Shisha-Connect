import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui';
import { supabaseConfigured } from '@/lib/supabase';
import { colors, font } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { BarSearchProvider } from '@/providers/BarSearchProvider';
import { GroupsProvider, useGroups } from '@/providers/GroupsProvider';

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        {supabaseConfigured ? (
          <AuthProvider>
            <GroupsProvider>
              <BarSearchProvider>
                <RootNavigator />
              </BarSearchProvider>
            </GroupsProvider>
          </AuthProvider>
        ) : (
          <SetupMissing />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { groups, loading: groupsLoading } = useGroups();

  if (loading || (session && groupsLoading)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const signedIn = !!session;
  const hasGroup = groups.length > 0;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasGroup}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasGroup}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="meetup/new" options={{ title: 'Treffen erstellen', presentation: 'modal' }} />
        <Stack.Screen name="meetup/[id]" options={{ title: 'Treffen' }} />
        <Stack.Screen name="meetup/edit/[id]" options={{ title: 'Treffen bearbeiten', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ title: 'Mitteilungen' }} />
        <Stack.Screen name="bar/new" options={{ title: 'Bar ergänzen', presentation: 'modal' }} />
        <Stack.Screen name="group-add" options={{ title: 'Gruppe beitreten', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Screen name="join/[code]" options={{ title: 'Einladung' }} />
    </Stack>
  );
}

function SetupMissing() {
  return (
    <Screen>
      <Text style={font.title}>Shisha Connect</Text>
      <Text style={font.body}>
        Das Backend ist noch nicht verbunden. Lege eine Datei „.env“ im Projektordner an (Vorlage: .env.example) und
        trage EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY ein. Details stehen in der README.
      </Text>
    </Screen>
  );
}
