import React from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  message: string;
};

export default function StatusModal({ visible, message }: Props) {
  const displayMessage = message || 'Working…';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: '#0E1628',
            borderRadius: 16,
            padding: 18,
            alignItems: 'center',
            gap: 10,
            minWidth: 220,
          }}
        >
          <ActivityIndicator />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="information-circle-outline" size={18} color="#9CC6FF" />
            <Text style={{ color: '#E5E7EB', fontWeight: '700', textAlign: 'center' }}>{displayMessage}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
