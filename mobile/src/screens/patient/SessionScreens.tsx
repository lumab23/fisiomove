import { Image, StyleSheet, Text, View } from 'react-native';
import { CameraPreview } from '../../components/CameraPreview';
import { Screen } from '../../components/Screen';
import { Body, Button, Card, Companion, Mascot, styles, Title } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
export function SessionPauseScreen() {
  const navigation = useFrontendNavigation();
  return (
    <Screen
      back="Exercício"
      title="Treino pausado"
      subtitle="A contagem está parada."
      footer={
        <>
          <Button
            label="Continuar exercício"
            onPress={() => navigation.goBack()}
          />
          <Button
            secondary
            label="Encerrar sessão"
            onPress={() => navigation.navigate('ConfirmExit')}
          />
          <Text style={styles.demo}>
            Nesta demonstração, a pausa é simulada.
          </Text>
        </>
      }
    >
      <Mascot />
    </Screen>
  );
}
export function SessionRestScreen() {
  const navigation = useFrontendNavigation();
  const { state, dispatch } = useDemo();
  return (
    <Screen
      title="DESCANSO"
      subtitle={`${state.active.goal} de ${state.active.goal} repetições concluídas.`}
      footer={
        <>
          <Button
            secondary
            label="Encerrar sessão"
            onPress={() => navigation.navigate('ConfirmExit')}
          />
          <Button
            label="Iniciar série 2"
            onPress={() => {
              dispatch({ type: 'next' });
              navigation.popTo('PatientExercise');
            }}
          />
          <Text style={styles.demo}>
            Inicie a próxima série quando estiver pronto.
          </Text>
        </>
      }
    >
      <Card title="Mantenha seu ritmo e os limites recomendados." />
      <Image
        source={require('../../assets/mascot-rest.png')}
        resizeMode="contain"
        style={sessionStyles.restMascot}
        accessible={false}
      />
    </Screen>
  );
}
export function CameraAdjustmentScreen() {
  const navigation = useFrontendNavigation();
  return (
    <Screen
      back="Exercício"
      title="Ajuste a câmera"
      subtitle="A contagem está pausada."
      footer={
        <Button label="Tentar novamente" onPress={() => navigation.goBack()} />
      }
    >
      <CameraPreview>
        <Card title="Braço fora da imagem">
          <Body>Afaste o celular.</Body>
        </Card>
      </CameraPreview>
    </Screen>
  );
}
export function MovementGuidanceScreen() {
  const navigation = useFrontendNavigation();
  return (
    <Screen
      back="Exercício"
      title="Ajuste o movimento"
      subtitle="A contagem espera sua posição."
      footer={
        <Button
          label="Voltar ao exercício"
          onPress={() => navigation.goBack()}
        />
      }
    >
      <CameraPreview>
        <Card title="Volte à posição inicial.">
          <Body>Mova o braço até o limite orientado.</Body>
        </Card>
      </CameraPreview>
    </Screen>
  );
}
export function ConfirmExitScreen() {
  const navigation = useFrontendNavigation();
  const { state, dispatch } = useDemo();
  return (
    <Screen
      back="Voltar à sessão"
      title="Encerrar o treino?"
      subtitle="A contagem está pausada."
      footer={
        <>
          <Button
            secondary
            label="Encerrar mesmo assim"
            onPress={() => {
              dispatch({
                type: 'finish',
                completed: false,
                id: state.active.id,
                date: new Date().toISOString(),
              });
              navigation.replace('SessionInterrupted');
            }}
          />
          <Button label="Voltar à sessão" onPress={() => navigation.goBack()} />
        </>
      }
    >
      <CameraPreview compact>
        <Card title="Treino não concluído">
          <Body>Você pode voltar depois.</Body>
        </Card>
      </CameraPreview>
    </Screen>
  );
}
export function SessionInterruptedScreen() {
  const navigation = useFrontendNavigation();
  return (
    <Screen
      title="Treino interrompido"
      subtitle="Você pode voltar depois."
      footer={
        <>
          <Button
            secondary
            label="Ir para o início"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: 'PatientHome' }] })
            }
          />
          <Button
            label="Voltar ao meu treino"
            onPress={() =>
              navigation.reset({
                index: 1,
                routes: [{ name: 'PatientHome' }, { name: 'PatientWorkout' }],
              })
            }
          />
        </>
      }
    >
      <CameraPreview compact>
        <Card title="Sessão não concluída">
          <Body>Fale com seu fisioterapeuta.</Body>
        </Card>
      </CameraPreview>
    </Screen>
  );
}
export function PatientCompletionScreen() {
  const navigation = useFrontendNavigation();
  const { state } = useDemo();
  const last = state.sessions[0];
  return (
    <Screen
      footer={
        <>
          <Button
            label="Voltar ao início"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: 'PatientHome' }] })
            }
          />
          <Button
            secondary
            label="Ver meu progresso"
            onPress={() => navigation.navigate('PatientProgress')}
          />
        </>
      }
    >
      <View style={styles.center}>
        <Mascot kind="gold" />
        <Title>Treino concluído</Title>
        <Text style={[styles.body, sessionStyles.centeredText]}>
          2 séries de {last?.repetitions ?? state.active.goal} repetições
          simuladas.
        </Text>
      </View>
      <Card>
        <Text style={styles.eyebrow}>CONQUISTA</Text>
        <Text style={styles.cardTitle}>
          {last?.total ?? 0} repetições • meta concluída
        </Text>
      </Card>
      <Body>
        As recompensas acompanham o plano, sem incentivar repetições extras.
      </Body>
    </Screen>
  );
}
export function ProgressEmpty() {
  return (
    <>
      <Card title="Nenhuma sessão ainda">
        <Body>Seu resumo aparecerá aqui depois de testar o treino.</Body>
      </Card>
      <Companion>Vamos no seu ritmo!</Companion>
    </>
  );
}

const sessionStyles = StyleSheet.create({
  centeredText: { textAlign: 'center' },
  restMascot: { width: 163, height: 165, alignSelf: 'center' },
});
