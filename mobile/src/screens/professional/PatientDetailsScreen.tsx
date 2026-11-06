import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { EmptyState, InlineError } from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { Note, Patient, Workout } from '../../contracts/domain';
import {
  usePatient,
  usePatientNotes,
  usePatientWorkouts,
} from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { colors, fonts, typography } from '../../theme/theme';
import {
  Body,
  Button,
  Card,
  Link,
  ListGroup,
  ListRow,
  SectionTitle,
} from '../../ui';
import { formatSessionDate } from '../patient/SessionRow';
import {
  apiErrorMessage,
  ResourceView,
  useReloadOnReturn,
  visibilityLabels,
  workoutStatusLabels,
} from './shared';

/** Kept only in this screen's memory and cleared when it loses focus. */
type TemporaryCredential = { email: string; password: string };

const accessErrors: Record<string, string> = {
  patient_access_already_active:
    'O acesso já está ativo. Se o paciente esqueceu a senha, gere uma nova senha provisória.',
  patient_access_not_created:
    'Libere o acesso antes de gerar uma nova senha provisória.',
  patient_email_required: 'Cadastre um e-mail para liberar o acesso.',
  patient_inactive: 'Este cadastro está desativado.',
  email_conflict: 'O e-mail deste paciente já é usado por outra conta.',
};

export function PatientDetailsScreen() {
  const navigation = useFrontendNavigation();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'PatientDetails'>>();
  const { patientId } = params;
  const patient = usePatient(patientId);
  const workouts = usePatientWorkouts(patientId);
  const notes = usePatientNotes(patientId);
  const [credential, setCredential] = useState<TemporaryCredential | null>(
    null,
  );
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useReloadOnReturn(patient.reload, workouts.reload, notes.reload);
  // The card is rendered on top while the button that issued it is further
  // down (and is replaced by a loading state on reload): bring it into view.
  useEffect(() => {
    if (credential) {
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  }, [credential]);
  // The temporary password is shown once: leaving the screen discards it.
  useFocusEffect(useCallback(() => () => setCredential(null), []));
  const name =
    patient.state.status === 'success' ? patient.state.data.full_name : null;
  return (
    <Screen
      professional
      back="Pacientes"
      title={name ?? 'Paciente'}
      scrollRef={scroll}
      footer={
        <Button
          label="Ver acompanhamento"
          onPress={() =>
            navigation.navigate('PatientMonitoring', { patientId })
          }
        />
      }
    >
      {credential ? (
        <TemporaryPasswordCard
          credential={credential}
          onDone={() => setCredential(null)}
        />
      ) : null}
      <ResourceView resource={patient} loadingLabel="Carregando paciente">
        {data => (
          <>
            <Card white title="Contato">
              <Body>{data.email ?? 'Sem e-mail cadastrado'}</Body>
              <Body>{data.phone ?? 'Sem telefone cadastrado'}</Body>
            </Card>
            <AccessCard
              patient={data}
              onIssued={value => {
                setCredential(value);
                patient.reload();
              }}
            />
          </>
        )}
      </ResourceView>
      <SectionTitle>Treinos</SectionTitle>
      <ResourceView
        resource={workouts}
        loadingLabel="Carregando treinos"
        empty={
          <EmptyState
            title="Nenhum treino criado"
            message="Monte o treino com exercícios aprovados do catálogo."
          />
        }
      >
        {page => (
          <ListGroup>
            {page.items.map(workout => (
              <ListRow
                key={workout.id}
                icon="activity"
                title={`Treino · ${workoutStatusLabels[workout.status]}`}
                description={workoutSummary(workout)}
                onPress={() =>
                  navigation.navigate('WorkoutReview', {
                    patientId,
                    workoutId: workout.id,
                  })
                }
              />
            ))}
          </ListGroup>
        )}
      </ResourceView>
      <Button
        secondary
        label="Criar treino"
        onPress={() =>
          navigation.navigate('WorkoutConfiguration', { patientId })
        }
      />
      <SectionTitle>Observações</SectionTitle>
      <ResourceView
        resource={notes}
        loadingLabel="Carregando observações"
        empty={
          <EmptyState
            title="Nenhuma observação registrada"
            message="Escreva orientações para o paciente ou anotações só para você."
          />
        }
      >
        {page => (
          <ListGroup>
            {page.items.map(note => (
              <ListRow
                key={note.id}
                icon="message"
                title={preview(note)}
                description={`${visibilityLabels[note.visibility]} · ${formatSessionDate(note.updated_at)}`}
                accessibilityHint="Abre a observação para editar."
                onPress={() =>
                  navigation.navigate('NoteEditor', {
                    patientId,
                    noteId: note.id,
                  })
                }
              />
            ))}
          </ListGroup>
        )}
      </ResourceView>
      <Button
        secondary
        label="Escrever observação"
        onPress={() => navigation.navigate('NoteEditor', { patientId })}
      />
    </Screen>
  );
}

function workoutSummary(workout: Workout) {
  const count = workout.items.length;
  return `${count} ${count === 1 ? 'exercício' : 'exercícios'} · versão ${workout.revision_number}`;
}

function preview(note: Note) {
  return note.content.length > 120
    ? `${note.content.slice(0, 117).trimEnd()}…`
    : note.content;
}

function AccessCard({
  patient,
  onIssued,
}: {
  patient: Patient;
  onIssued: (credential: TemporaryCredential) => void;
}) {
  const { show } = useScreenMessage();
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [failure, setFailure] = useState('');
  const run = async (operation: 'activate' | 'reset') => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure('');
    try {
      const result =
        operation === 'activate'
          ? await appDependencies.patients.activateAccess(patient.id)
          : await appDependencies.patients.resetTemporaryPassword(patient.id);
      setConfirmReset(false);
      // `Screen` announces this message to screen readers.
      show(
        operation === 'activate'
          ? 'Acesso liberado. A senha provisória está no topo da tela.'
          : 'Nova senha provisória gerada. Ela está no topo da tela.',
      );
      onIssued({ email: result.email, password: result.temporary_password });
    } catch (cause) {
      setFailure(apiErrorMessage(cause, accessErrors));
    } finally {
      setBusy(false);
    }
  };
  if (!patient.is_active) {
    return (
      <Card white title="Acesso ao aplicativo">
        <Body>Cadastro desativado. O acesso ao aplicativo está bloqueado.</Body>
      </Card>
    );
  }
  if (!patient.email) {
    return (
      <Card white title="Acesso ao aplicativo">
        <Body>
          Para liberar o acesso, o paciente precisa ter um e-mail cadastrado.
        </Body>
      </Card>
    );
  }
  const active = patient.has_access && patient.access_is_active;
  return (
    <Card white title="Acesso ao aplicativo">
      {failure ? <InlineError message={failure} /> : null}
      {!active ? (
        <>
          <Body>
            O paciente ainda não pode entrar no aplicativo. Ao liberar, uma
            senha provisória será mostrada uma única vez.
          </Body>
          <Button
            label={busy ? 'Liberando…' : 'Liberar acesso ao app'}
            disabled={busy}
            onPress={() => run('activate')}
          />
        </>
      ) : confirmReset ? (
        <>
          <Body>
            A senha atual do paciente deixará de funcionar e ele precisará criar
            uma nova no próximo acesso. Deseja continuar?
          </Body>
          <Button
            label={busy ? 'Gerando…' : 'Gerar nova senha provisória'}
            disabled={busy}
            onPress={() => run('reset')}
          />
          <Link label="Cancelar" onPress={() => setConfirmReset(false)} />
        </>
      ) : (
        <>
          <Body>
            {patient.must_change_password
              ? 'Acesso liberado. Aguardando o paciente entrar e criar a própria senha.'
              : 'Acesso ativo.'}
          </Body>
          <Body>
            Se o paciente esqueceu a senha, gere uma nova senha provisória.
          </Body>
          <Button
            secondary
            label="Redefinir senha provisória"
            onPress={() => setConfirmReset(true)}
          />
        </>
      )}
    </Card>
  );
}

function TemporaryPasswordCard({
  credential,
  onDone,
}: {
  credential: TemporaryCredential;
  onDone: () => void;
}) {
  return (
    <Card white title="Senha provisória">
      <Body>
        Entregue estes dados ao paciente pessoalmente ou por um canal seguro. A
        senha aparece só agora: ao sair desta tela, não será possível vê-la de
        novo.
      </Body>
      <Body>{`E-mail de acesso: ${credential.email}`}</Body>
      <Text
        selectable
        accessibilityLabel={`Senha provisória: ${credential.password.split('').join(' ')}`}
        style={passwordStyles.value}
      >
        {credential.password}
      </Text>
      <Body>No primeiro acesso, o paciente vai criar a própria senha.</Body>
      <Button label="Já entreguei a senha" onPress={onDone} />
    </Card>
  );
}

const passwordStyles = StyleSheet.create({
  value: {
    color: colors.text,
    ...typography.title,
    fontFamily: fonts.bold,
  },
});
