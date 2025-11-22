import React from 'react';
import { ActivityIndicator, TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';
import { authStyles } from '../../theme/authStyles';

type Props = TouchableOpacityProps & {
  title: string;
  loading?: boolean;
};

export default function AuthButton({ title, loading, style, ...rest }: Props) {
  return (
    <TouchableOpacity style={[authStyles.primaryButton, style]} disabled={loading} {...rest}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={authStyles.primaryButtonText}>{title}</Text>}
    </TouchableOpacity>
  );
}
