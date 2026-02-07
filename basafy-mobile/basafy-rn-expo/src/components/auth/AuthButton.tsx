import React from 'react';
import { ActivityIndicator, TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';
import { createAuthStyles } from '../../theme/authStyles';
import { useTheme } from '../../theme/palette';

type Props = TouchableOpacityProps & {
  title: string;
  loading?: boolean;
};

export default function AuthButton({ title, loading, style, ...rest }: Props) {
  const { palette } = useTheme();
  const authStyles = createAuthStyles(palette);
  return (
    <TouchableOpacity style={[authStyles.primaryButton, style]} disabled={loading} {...rest}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={authStyles.primaryButtonText}>{title}</Text>}
    </TouchableOpacity>
  );
}
