import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, useColorScheme } from 'react-native';
import Slider from '@react-native-community/slider';

interface Props {
  balanceCoins: number;
  onInitiateTopUp: (usdAmount: number, provider: 'flutterwave' | 'mtn_momo', phone?: string) => Promise<void>;
}

export function TopUpScreen({ balanceCoins, onInitiateTopUp }: Props) {
  const isDark = useColorScheme() === 'dark';
  const [usdAmount, setUsdAmount] = useState<number>(5);
  const [provider, setProvider] = useState<'flutterwave' | 'mtn_momo'>('flutterwave');
  const [phone, setPhone] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const coins = Math.round(usdAmount * 100);

  const handlePay = async () => {
    setSubmitting(true);
    try {
      await onInitiateTopUp(usdAmount, provider, provider === 'mtn_momo' ? phone : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#09090b' : '#fafafa' }]}>
      <Text style={[styles.eyebrow, { color: isDark ? '#a1a1aa' : '#71717a' }]}>Wallet Balance</Text>
      <Text style={[styles.balance, { color: isDark ? '#fafafa' : '#18181b' }]}>
        {balanceCoins.toLocaleString()} coins
      </Text>
      <Text style={[styles.subtitle, { color: isDark ? '#a1a1aa' : '#52525b' }]}>
        4 free messages in every new chat. $1.00 = 100 coins (100 messages).
      </Text>

      <View style={[styles.card, { backgroundColor: isDark ? '#18181b' : '#ffffff', borderColor: isDark ? '#27272a' : '#e4e4e7' }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.label, { color: isDark ? '#e4e4e7' : '#27272a' }]}>Custom Amount</Text>
          <Text style={styles.accentAmount}>${usdAmount.toFixed(2)} · {coins.toLocaleString()} coins</Text>
        </View>

        <Slider
          minimumValue={1}
          maximumValue={250}
          step={1}
          value={usdAmount}
          onValueChange={setUsdAmount}
          minimumTrackTintColor="#e11d48"
          maximumTrackTintColor={isDark ? '#3f3f46' : '#d4d4d8'}
          thumbTintColor="#e11d48"
          style={styles.slider}
        />

        <View style={styles.providerRow}>
          {(['flutterwave', 'mtn_momo'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => setProvider(item)}
              style={[
                styles.providerBtn,
                provider === item && styles.providerBtnActive,
                { borderColor: provider === item ? '#e11d48' : isDark ? '#3f3f46' : '#d4d4d8' },
              ]}
            >
              <Text style={{ color: isDark ? '#fafafa' : '#18181b', fontWeight: '600' }}>
                {item === 'flutterwave' ? 'Flutterwave' : 'MTN MoMo'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {provider === 'mtn_momo' && (
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+256 770 000 000"
            placeholderTextColor="#71717a"
            keyboardType="phone-pad"
            style={[styles.input, { color: isDark ? '#fafafa' : '#18181b', borderColor: isDark ? '#3f3f46' : '#d4d4d8' }]}
          />
        )}

        <TouchableOpacity onPress={handlePay} disabled={submitting} style={styles.payButton}>
          <Text style={styles.payButtonText}>
            {submitting ? 'Initiating Checkout...' : `Pay $${usdAmount.toFixed(2)} for ${coins.toLocaleString()} Coins`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  eyebrow: { fontSize: 12, fontWeight: '600' },
  balance: { fontSize: 32, fontWeight: '700', marginTop: 4 },
  subtitle: { fontSize: 13, marginTop: 6, marginBottom: 20 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
  accentAmount: { fontSize: 14, fontWeight: '700', color: '#e11d48' },
  slider: { width: '100%', height: 40, marginVertical: 12 },
  providerRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  providerBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  providerBtnActive: { backgroundColor: 'rgba(225, 29, 72, 0.08)' },
  input: { marginTop: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  payButton: { marginTop: 16, backgroundColor: '#e11d48', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  payButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});
