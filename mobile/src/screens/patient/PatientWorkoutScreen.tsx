import { Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { Body, Button, Card, Companion, styles } from '../../ui';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
export function PatientWorkoutScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  const { dispatch } = useDemo();
  return (
    <Screen
      back="Início"
      title="Seu treino de hoje"
      subtitle="Orientado pelo seu fisioterapeuta."
      footer={
        <Button
          label="Preparar exercício"
          disabled={!patient.published}
          onPress={() => {
            dispatch({ type: 'start' });
            navigation.navigate('PatientPreparation');
          }}
        />
      }
    >
      {patient.published ? (
        <Card title="Elevação de braço sentado">
          <Body>2 séries de {patient.repetitions} repetições</Body>
          <Body>Braço direito</Body>
        </Card>
      ) : (
        <Card title="Nenhum treino publicado">
          <Body>
            O profissional ainda está preparando seu treino. Aguarde a
            publicação.
          </Body>
        </Card>
      )}
      {patient.note !== '' && (
        <Card white title="Orientação do profissional">
          <Body>{patient.note}</Body>
        </Card>
      )}
      <Companion>Vamos no seu ritmo!</Companion>
      <Text style={styles.demo}>
        Exemplo visual do PDF. Não é uma prescrição clínica real.
      </Text>
    </Screen>
  );
}
