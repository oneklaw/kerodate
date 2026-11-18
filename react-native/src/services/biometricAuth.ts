import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export async function authenticateWithBiometrics(): Promise<{ success: boolean; error?: string }> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { success: false, error: 'Device biometrics not enrolled.' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Kora Wallet & Messages',
    fallbackLabel: 'Use Security PIN',
    disableDeviceFallback: false,
  });

  return { success: result.success, error: result.error };
}

export async function storeEncryptedSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('kora_session_token', token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
