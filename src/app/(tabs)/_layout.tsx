import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerForPush } from '@/lib/push';
import { colors } from '@/lib/theme';

function openFromNotification(notification: Notifications.Notification) {
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
}

export default function TabsLayout() {
  // Register this device for push if the user already allowed notifications (asking happens on the home screen).
  useEffect(() => {
    registerForPush(false);
  }, []);

  // Tapping a push notification opens the matching meetup – also when the app was closed.
  useEffect(() => {
    // Push only exists on iOS/Android (the web build is just a preview).
    if (Platform.OS === 'web') return;
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      Notifications.clearLastNotificationResponse();
      openFromNotification(last.notification);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      Notifications.clearLastNotificationResponse();
      openFromNotification(response.notification);
    });
    return () => subscription.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Treffen', tabBarIcon: ({ color, size }) => <Ionicons name="flame" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="bars"
        options={{ title: 'Bars', tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="group"
        options={{ title: 'Gruppe', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
