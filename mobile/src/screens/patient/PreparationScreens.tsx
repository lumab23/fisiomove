import { Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Body, Button, Card, Link, Mascot, styles } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { LocalPoseCamera } from '../../features/vision/LocalPoseCamera';
export function PatientPreparationScreen() {
  const navigation = useFrontendNavigation();
  const { state } = useDemo();
  return (
    <Screen
      back="Voltar"
      title="Prepare o celular"
      subtitle={state.voice ? 'Comandos de voz simulados.' : undefined}
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
  const { requestPermission } = useCameraPermission();
  const requestCamera = async () => {
    const granted = await requestPermission();
    navigation.replace(granted ? 'Calibration' : 'CameraDenied');
  };
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
          <Button label="Permitir câmera" onPress={requestCamera} />
        </>
      }
    >
      <Card>
        <Body>A análise é local; imagens não são enviadas.</Body>
      </Card>
      <Mascot />
    </Screen>
  );
}
export function CameraDeniedScreen() {
  const navigation = useFrontendNavigation();
  const { requestPermission } = useCameraPermission();
  return (
    <Screen
      back="Preparação"
      title="Câmera não autorizada"
      footer={
        <>
          <Button
            secondary
            label="Voltar à preparação"
            onPress={() => navigation.popTo('PatientPreparation')}
          />
          <Button
            label="Tentar permitir câmera"
            onPress={() => {
              requestPermission().then(granted => {
                navigation.replace(granted ? 'Calibration' : 'CameraDenied');
              });
            }}
          />
        </>
      }
    >
      <Card>
        <Body>Permita o acesso para iniciar o treino.</Body>
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
      footer={
        <>
          <Button
            secondary
            label="Continuar sem voz"
            onPress={() => finish(false)}
          />
          <Button label="Usar comandos" onPress={() => finish(true)} />
          <Text style={styles.demo}>
            Comandos simulados; microfone inativo.
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
  const isFocused = useIsFocused();
  return (
    <Screen
      back="Preparação"
      title="Ajuste seu movimento"
      footer={
        <>
          <Button
            label="Começar exercício"
            onPress={() => navigation.navigate('PatientExercise')}
          />
          <Text style={styles.demo}>
            A contagem clínica depende da aprovação de uma regra por um
            fisioterapeuta.
          </Text>
        </>
      }
    >
      <Card>
        <LocalPoseCamera side="right" active={isFocused} />
      </Card>
      <Card white>
        <Text style={styles.cardTitle}>Faça o movimento sem forçar.</Text>
        <Body>
          Os pontos são estimativas; não validam o movimento nem a calibração.
        </Body>
      </Card>
    </Screen>
  );
}
