import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { AuthLayout, authText } from '../../components/AuthLayout';
import type { AuthStackParamList } from '../../navigation/types';
import { spacing } from '../../theme/theme';
import { Button } from '../../ui';

/**
 * Explains how access works. There is no public sign up (Q-P2): the
 * physiotherapist creates the account and hands over a provisional password.
 */
export function FirstAccessScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<AuthStackParamList, 'FirstAccess'>
    >();
  return (
    <AuthLayout onBack={() => navigation.goBack()}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={authText.title}>
          Primeiro acesso
        </Text>
        <Text style={authText.body}>
          Seu fisioterapeuta entrega um e-mail e uma senha provisória. Entre com
          eles e, em seguida, você vai criar a sua própria senha.
        </Text>
        <Text style={authText.body}>
          Esqueceu a senha? Peça ao seu fisioterapeuta uma nova senha
          provisória.
        </Text>
      </View>
      <Button
        label="Entrar com a senha provisória"
        onPress={() => navigation.navigate('Login')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.md },
});
