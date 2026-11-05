import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Body, Button, Card, Link, Mascot, styles } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import {
  resetToPatientTabs,
  useFrontendNavigation,
} from '../../navigation/frontendTypes';
import {
  CameraMessage,
  CameraSettingsSteps,
} from '../../features/vision/CameraGuidance';
import { useCameraPermission } from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { LocalPoseCamera } from '../../features/vision/LocalPoseCamera';
export function PatientPreparationScreen() {
  const navigation = useFrontendNavigation();
  const { state } = useDemo();
  const { hasPermission: cameraReady } = useCameraPermission();
  return (
    <Screen
      back="Voltar"
      title="Prepare o celular"
      subtitle={state.voice ? 'Comandos de voz simulados.' : undefined}
      footer={
        <>
          <Button
            label="Continuar"
            onPress={() =>
              navigation.navigate(
                cameraReady ? 'Calibration' : 'CameraPermission',
              )
            }
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
  const { status, requestPermission } = useCameraPermission();
  const [asked, setAsked] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  useEffect(() => {
    if (status === 'authorized') {
      navigation.replace('Calibration');
    }
  }, [navigation, status]);
  const backToExercises = () => resetToPatientTabs(navigation, 'workout');
  const activate = async () => {
    setRequesting(true);
    try {
      await requestPermission();
    } finally {
      setAsked(true);
      setRequesting(false);
    }
  };
  if (status === 'authorized') {
    return <Screen back="Preparação" />;
  }
  if (status === 'restricted') {
    return (
      <Screen back="Preparação">
        <CameraMessage
          icon="cameraOff"
          title="A câmera está bloqueada neste celular"
          description="Os ajustes do aparelho não deixam usar a câmera. Peça ajuda a quem cuida das configurações do seu celular."
        >
          <Button
            secondary
            label="Voltar aos exercícios"
            onPress={backToExercises}
          />
        </CameraMessage>
      </Screen>
    );
  }
  if (status === 'denied' || asked) {
    return (
      <Screen back="Preparação">
        <CameraMessage
          icon="cameraOff"
          title="A câmera está desativada"
          description="Para acompanhar seus movimentos durante o exercício, precisamos acessar a câmera do seu dispositivo."
        >
          {showSteps ? (
            <CameraSettingsSteps />
          ) : (
            <Button
              label="Como permitir a câmera"
              onPress={() => setShowSteps(true)}
            />
          )}
          <Button
            secondary
            label="Voltar aos exercícios"
            onPress={backToExercises}
          />
        </CameraMessage>
      </Screen>
    );
  }
  return (
    <Screen back="Preparação">
      <CameraMessage
        icon="camera"
        title="Vamos ativar sua câmera?"
        description="A câmera ajuda a acompanhar seus movimentos durante o exercício."
      >
        <Button
          icon="camera"
          label="Ativar câmera"
          disabled={requesting}
          onPress={activate}
        />
        <Button
          secondary
          label="Agora não"
          onPress={() => navigation.goBack()}
        />
      </CameraMessage>
      <Text style={[styles.demo, preparation.centered]}>
        As imagens ficam só no seu celular e não são enviadas.
      </Text>
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

const preparation = StyleSheet.create({
  centered: { textAlign: 'center' },
});
