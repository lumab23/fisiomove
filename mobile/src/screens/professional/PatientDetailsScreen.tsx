import { Screen, Notice } from '../../components/Screen';
import { Body, Button, Card, Link } from '../../ui';
import { useDemoPatient } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
export function PatientDetailsScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  return (
    <Screen
      professional
      back="Pacientes"
      title={patient.name}
      subtitle="Ficha da paciente"
      footer={
        <Button
          label="Alterar exercício"
          onPress={() => navigation.navigate('WorkoutConfiguration')}
        />
      }
    >
      <Notice />
      <Card title="Elevação de braço sentado">
        <Body>2 séries de {patient.repetitions} • braço direito</Body>
        <Link
          label={
            patient.published
              ? 'Exercício atribuído  ›'
              : 'Rascunho • revisar e publicar  ›'
          }
          onPress={() => navigation.navigate('WorkoutConfiguration')}
        />
      </Card>
      <Card white title="Orientação do profissional">
        <Body>{patient.note || 'Nenhuma observação registrada.'}</Body>
      </Card>
      <Link
        label="Escrever observação  ›"
        onPress={() => navigation.navigate('NoteEditor')}
      />
      <Link
        label="Ver acompanhamento  ›"
        onPress={() => navigation.navigate('PatientMonitoring')}
      />
      <Link
        label="Ver como paciente (demo)  ›"
        onPress={() =>
          navigation.reset({ index: 0, routes: [{ name: 'PatientHome' }] })
        }
      />
    </Screen>
  );
}
