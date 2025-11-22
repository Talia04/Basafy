import React from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authStyles } from '../../theme/authStyles';

type Props = TextInputProps & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onPressRightIcon?: () => void;
};

export default function TextField({ label, icon, rightIcon, onPressRightIcon, ...rest }: Props) {
  const [focused, setFocused] = React.useState(false);
  const highlightStyle = focused ? authStyles.inputContainerFocused : undefined;

  return (
    <>
      <Text style={authStyles.label}>{label}</Text>
      <View style={[authStyles.inputContainer, highlightStyle]}>
        {icon && <Ionicons name={icon} size={18} color="#7c8aa6" style={{ marginRight: 10 }} />}
        <TextInput
          placeholderTextColor="#7c8aa6"
          style={authStyles.textInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {rightIcon && (
          <Ionicons
            name={rightIcon}
            size={18}
            color="#7c8aa6"
            onPress={onPressRightIcon}
            accessibilityLabel="Toggle visibility"
          />
        )}
      </View>
    </>
  );
}
