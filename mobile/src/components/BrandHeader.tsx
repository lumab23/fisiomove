import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme/theme';

export function BrandHeader() {
  return (
    <View style={styles.container} accessibilityRole="header">
      <Text style={styles.brand}>FisioMove</Text>
      <View style={styles.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  brand: {
    color: colors.primary,
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  accent: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    height: 4,
    width: 44,
  },
});
