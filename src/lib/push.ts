// Real push notifications via expo-notifications + Expo Push Service (APNs on iOS, FCM on Android).
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const TOKEN_KEY = 'shisha.pushToken';

// Show notifications as banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('meetups', {
    name: 'Treffen & Erinnerungen',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#FF8A3D',
  });
}

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PushPermission;
}

export type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'denied' | 'simulator' | 'no-project-id' | 'error'; message: string };

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
}

/**
 * Asks for permission (only if `ask` is true and the user has not decided yet),
 * fetches the Expo push token and stores it for the signed in user.
 */
export async function registerForPush(ask: boolean): Promise<RegisterResult> {
  try {
    await ensureAndroidChannel();
    let status = await getPushPermission();
    if (status === 'undetermined' && ask) {
      const result = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      status = result.status as PushPermission;
    }
    if (status !== 'granted') {
      return { ok: false, reason: 'denied', message: 'Benachrichtigungen sind nicht erlaubt.' };
    }
    if (!Device.isDevice) {
      return {
        ok: false,
        reason: 'simulator',
        message: 'Push-Nachrichten funktionieren nur auf einem echten Gerät.',
      };
    }
    const id = projectId();
    if (!id) {
      return {
        ok: false,
        reason: 'no-project-id',
        message: 'EAS projectId fehlt (siehe README: „eas init“).',
      };
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) throw new Error(error.message);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return { ok: true, token };
  } catch (error) {
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

/** Called before sign out so this device stops receiving the user's notifications. */
export async function unregisterPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
  await AsyncStorage.removeItem(TOKEN_KEY);
}
