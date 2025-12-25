import React from 'react';
import { TextInput, View, Text, TextInputProps, Pressable, TouchableOpacity } from 'react-native';
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
  const inputRef = React.useRef<TextInput>(null);

  return (
    <>
      <Text style={authStyles.label}>{label}</Text>
      <Pressable onPress={() => inputRef.current?.focus()} style={[authStyles.inputContainer, highlightStyle]}>
        {icon && <Ionicons name={icon} size={18} color="#7c8aa6" style={{ marginRight: 10 }} />}
        <TextInput
          ref={inputRef}
          placeholderTextColor="#7c8aa6"
          style={authStyles.textInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          blurOnSubmit={false}
          returnKeyType="next"
          {...rest}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={() => {
              onPressRightIcon?.();
              inputRef.current?.focus();
            }}
            hitSlop={8}
          >
            <Ionicons name={rightIcon} size={18} color="#7c8aa6" accessibilityLabel="Toggle visibility" />
          </TouchableOpacity>
        )}
      </Pressable>
    </>
  );
}
