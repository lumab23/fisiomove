import { Screen } from '../../components/Screen';
import { Body, Button, Card, Companion } from '../../ui';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
export function PatientMonitoringScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  const { state } = useDemo();
  const last = state.sessions.find(session => session.patientId === patient.id);
  return (
    <Screen
      professional
      back={patient.name}
      title="Acompanhamento"
      subtitle={`Paciente: ${patient.name}`}
      footer={
        <Button
          label="Voltar aos pacientes"
          onPress={() => navigation.navigate('PatientList')}
        />
      }
    >
      <Card
        title={
          patient.published ? 'Treino disponibilizado' : 'Treino em rascunho'
        }
      >
        <Body>Elevação de braço sentado</Body>
        <Body>2 séries de {patient.repetitions} • braço direito</Body>
      </Card>
      {last ? (
        <Card white title={`Última sessão: ${last.total} repetições`}>
          <Body>
            {last.completed
              ? `2 séries de ${last.repetitions} • concluída`
              : 'Sessão interrompida'}
          </Body>
          <Body>Resultado simulado; treino atual pode variar.</Body>
        </Card>
      ) : (
        <Card white title="Nenhuma sessão registrada">
          <Body>Este paciente ainda não testou o treino na demonstração.</Body>
        </Card>
      )}
      <Companion>Tudo acompanhado.</Companion>
    </Screen>
  );
}
