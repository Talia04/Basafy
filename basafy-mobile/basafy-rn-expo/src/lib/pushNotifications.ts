import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@backend/supabase/client';

const DEVICE_ID_KEY = 'basafy:device-id';

async function getDeviceId() {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  const generated = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

export async function registerForPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return { ok: false, error: 'Permissions not granted.' };
  }

  const projectId =
    (Constants as any)?.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? undefined;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  return { ok: true, token: token.data };
}

export async function upsertPushToken(token: string, notificationsEnabled: boolean) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    throw new Error('Not authenticated.');
  }
  const deviceId = await getDeviceId();
  const payload = {
    user_id: userId,
    device_id: deviceId,
    platform: Platform.OS,
    expo_push_token: token,
    notifications_enabled: notificationsEnabled,
  };
  const { error } = await supabase
    .from('user_devices')
    .upsert(payload, { onConflict: 'user_id,device_id' });
  if (error) {
    throw error;
  }
}

export async function disablePushNotifications() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    throw new Error('Not authenticated.');
  }
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from('user_devices')
    .upsert({ user_id: userId, device_id: deviceId, notifications_enabled: false }, { onConflict: 'user_id,device_id' });
  if (error) {
    throw error;
  }
}
