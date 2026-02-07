import React from 'react';
import { View } from 'react-native';
import { createOnboardingStyles } from '../styles';
import { useTheme } from '../../../theme/palette';

type PaginationProps = {
  total: number;
  index: number;
  colors: string[];
};

const Pagination = ({ total, index, colors }: PaginationProps) => {
  const { palette, isDark } = useTheme();
  const styles = createOnboardingStyles(palette);
  return (
    <View style={styles.pagination}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === index;
        return (
          <View
            key={String(i)}
            style={[
              styles.dot,
              {
                backgroundColor: isActive ? colors[i] : '#1D2433',
                width: isActive ? 40 : 12,
              },
            ]}
            accessibilityLabel={isActive ? 'Active slide indicator' : 'Inactive slide indicator'}
          />
        );
      })}
    </View>
  );
};

export default React.memo(Pagination);
