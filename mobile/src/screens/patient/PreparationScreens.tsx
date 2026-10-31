import { Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Body, Button, Card, Companion, Link, Mascot, styles } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
export function PatientPreparationScreen() {
  const navigation = useFrontendNavigation();
  const { state } = useDemo();
  return (
    <Screen
      back="Meu treino"
      title="Prepare o celular"
      subtitle={
        state.voice
          ? 'Comandos de voz ativados (simulação).'
          : 'Deixe tudo pronto antes de começar.'
      }
      footer={
        <>
          <Button
            label="Continuar"
            onPress={() => navigation.navigate('CameraPermission')}
          />
          <Link
            label={
              state.voice
                ? 'Alterar comandos de voz  ›'
                : 'Configurar comandos de voz  ›'
            }
            onPress={() => navigation.navigate('VoicePermission')}
          />
        </>
      }
    >
      <Mascot />
      <Card white>
        {[
          'Apoie o celular em um local firme.',
          'Sente-se de frente para a câmera.',
          'Deixe o braço inteiro visível.',
        ].map((instruction, index) => (
          <View key={instruction} style={styles.step}>
            <Text style={styles.number}>{index + 1}</Text>
            <View style={styles.stepContent}>
              <Body>{instruction}</Body>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
export function CameraPermissionScreen() {
  const navigation = useFrontendNavigation();
  return (
    <Screen
      back="Preparação"
      title="Usar a câmera?"
      subtitle="Para acompanhar o braço durante a sessão."
      footer={
        <>
          <Button
            secondary
            label="Não permitir"
            onPress={() => navigation.replace('CameraDenied')}
          />
          <Button
            label="Permitir câmera"
            onPress={() => navigation.replace('Calibration')}
          />
          <Text style={styles.demo}>
            Pedido de acesso representado visualmente. A câmera não é ativada.
          </Text>
        </>
      }
    >
      <Card title="Autorize o uso da câmera.">
        <Body>Não guardamos imagens nesta demonstração.</Body>
      </Card>
      <Mascot />
    </Screen>
  );
}
export function CameraDeniedScreen() {
  const navigation = useFrontendNavigation();
  return (
    <Screen
      back="Preparação"
      title="Câmera não autorizada"
      subtitle="Sem ela, o treino não pode começar."
      footer={
        <>
          <Button
            secondary
            label="Voltar à preparação"
            onPress={() => navigation.popTo('PatientPreparation')}
          />
          <Button
            label="Tentar permitir câmera"
            onPress={() => navigation.replace('CameraPermission')}
          />
          <Text style={styles.demo}>
            Estado ilustrativo após negar a permissão.
          </Text>
        </>
      }
    >
      <Card title="A câmera está desativada.">
        <Body>Tente permitir novamente ou volte.</Body>
      </Card>
      <Mascot />
    </Screen>
  );
}
export function VoicePermissionScreen() {
  const navigation = useFrontendNavigation();
  const { dispatch } = useDemo();
  const finish = (enabled: boolean) => {
    dispatch({ type: 'voice', enabled });
    navigation.goBack();
  };
  return (
    <Screen
      back="Preparação"
      title="Usar comandos de voz?"
      subtitle="É opcional. Você também pode usar os botões."
      footer={
        <>
          <Button
            secondary
            label="Continuar sem voz"
            onPress={() => finish(false)}
          />
          <Button label="Permitir microfone" onPress={() => finish(true)} />
          <Text style={styles.demo}>
            Nesta demonstração, o microfone não é ativado.
          </Text>
        </>
      }
    >
      <Mascot />
    </Screen>
  );
}
export function CalibrationScreen() {
  const navigation = useFrontendNavigation();
  return (
    <Screen
      back="Preparação"
      title="Ajuste seu movimento"
      subtitle="A câmera precisa ver seu braço."
      footer={
        <>
          <Button
            label="Começar exercício"
            onPress={() => navigation.navigate('PatientExercise')}
          />
          <Text style={styles.demo}>
            Câmera e calibração simuladas neste protótipo.
          </Text>
        </>
      }
    >
      <Card title="Fique de frente para o celular.">
        <Body>Deixe o braço relaxado.</Body>
        <Body>Mova-se apenas até seu limite.</Body>
      </Card>
      <Card white title="Faça o movimento indicado, sem forçar.">
        <Body>A calibração não muda a meta do profissional.</Body>
      </Card>
      <Companion>Pronta para começar?</Companion>
    </Screen>
  );
}
