import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AuthHero } from '../../components/AuthHero';
import { AuthLayout, authText } from '../../components/AuthLayout';
import type { AuthStackParamList } from '../../navigation/types';
import { spacing } from '../../theme/theme';
import { Button } from '../../ui';

export function WelcomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList, 'Welcome'>>();
  return (
    <AuthLayout hero={<AuthHero />}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={authText.title}>
          Olá! Vamos nos movimentar?
        </Text>
        <Text style={authText.body}>
          Seus exercícios, no seu ritmo, com quem cuida de você.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Entrar" onPress={() => navigation.navigate('Login')} />
        <Button
          label="Primeiro acesso"
          secondary
          onPress={() => navigation.navigate('FirstAccess')}
        />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.md },
  actions: { gap: spacing.md },
});
