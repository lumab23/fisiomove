import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { friendlyErrorMessage } from '../../api/errors';
import { ExerciseImageGallery } from '../../components/ExerciseImageGallery';
import { Screen } from '../../components/Screen';
import { InlineError } from '../../components/ScreenStates';
import type { UUID } from '../../contracts/common';
import {
  countedRepetitions,
  currentWorkoutItem,
  useActiveSession,
  type ActiveSession,
} from '../../features/session/ActiveSession';
import { useSessionResult } from '../../features/session/useSessionResult';
import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  Mascot,
  SectionTitle,
  styles,
} from '../../ui';
import {
  resetToPatientTabs,
  useFrontendNavigation,
  type ActiveSessionParams,
  type FrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { selectSessionSyncStatus } from '../../sync/status';
import { useSessionSync } from '../../sync/SessionSyncContext';
import type { PublicSessionSyncStatus } from '../../sync/types';
import { spacing } from '../../theme/theme';
import {
  exerciseImages,
  exerciseName,
  exerciseSourceText,
  exerciseText,
  originalLanguageSeal,
  sideLabels,
  textLanguage,
} from './workoutText';

/** Routes after "Começar exercício" carry only the local session ID. */
function useSessionRoute(): ActiveSessionParams {
  return useRoute<RouteProp<FrontendStackParamList, 'ConfirmExit'>>().params;
}

function MissingSession() {
  const navigation = useFrontendNavigation();
  return (
    <EmptyState
      title="Não encontramos o treino em andamento"
      action={{
        label: 'Voltar aos exercícios',
        onPress: () => resetToPatientTabs(navigation, 'workout'),
      }}
    >
      Abra seus exercícios e toque em Continuar treino.
    </EmptyState>
  );
}

/**
 * "Como fazer": the snapshot text (pt-BR when translated, otherwise the
 * original with a seal), its images, the physiotherapist's guidance and the
 * source. No corrective text is written by the app (RN18). Opening it pauses
 * the session.
 */
export function MovementGuidanceScreen() {
  const { clientSessionId } = useSessionRoute();
  const { session } = useActiveSession(clientSessionId);
  if (!session) {
    return (
      <Screen back="Voltar" title="Como fazer">
        <MissingSession />
      </Screen>
    );
  }
  return <MovementGuidance session={session} />;
}

function MovementGuidance({ session }: { session: ActiveSession }) {
  const navigation = useFrontendNavigation();
  const item = currentWorkoutItem(session);
  const content = exerciseText(item);
  const language = textLanguage(content.original);
  const source = exerciseSourceText(item);
  const guidance = [item.professional_guidance, session.workout.instructions]
    .map(text => text?.trim())
    .filter((text): text is string => Boolean(text));
  return (
    <Screen
      back="Exercício"
      title="Como fazer"
      subtitle="O treino está pausado."
      footer={
        <Button
          label="Voltar ao exercício"
          onPress={() => navigation.goBack()}
        />
      }
    >
      <Card white>
        <Text accessibilityLanguage={language} style={styles.cardTitle}>
          {content.name}
        </Text>
        <Body>{sideLabels[item.side]}</Body>
      </Card>
      <ExerciseImageGallery
        images={exerciseImages(item.exercise_snapshot)}
        exerciseName={content.name}
      />
      {guidance.length ? (
        <Card white title="Orientação do profissional">
          {guidance.map(text => (
            <Body key={text}>{text}</Body>
          ))}
        </Card>
      ) : null}
      <SectionTitle>Passos</SectionTitle>
      {/* Untranslated library text stays in English (KI-012, DEC-011). */}
      {content.original ? <Badge label={originalLanguageSeal} /> : null}
      {content.steps ? (
        <Text accessibilityLanguage={language} style={styles.body}>
          {content.steps}
        </Text>
      ) : (
        <Body>Este exercício não tem passos escritos.</Body>
      )}
      {source ? <Text style={styles.demo}>{source}</Text> : null}
    </Screen>
  );
}

export function ConfirmExitScreen() {
  const { clientSessionId } = useSessionRoute();
  const { session } = useActiveSession(clientSessionId);
  if (!session) {
    return (
      <Screen back="Voltar" title="Encerrar o treino?">
        <MissingSession />
      </Screen>
    );
  }
  return <ConfirmExit session={session} />;
}

function ConfirmExit({ session }: { session: ActiveSession }) {
  const navigation = useFrontendNavigation();
  const { discardDraft } = useSessionSync();
  const { clear } = useActiveSession();
  const result = useSessionResult(session.execution, session.draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientSessionId = session.draft.client_session_id;

  const exit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (session.snapshot.status === 'completed') {
        await result.complete();
        showAfterTabs(navigation, 'PatientCompletion', clientSessionId);
      } else if (countedRepetitions(session.snapshot) === 0) {
        // Nothing to record: the draft is discarded (DEC-009).
        await discardDraft(clientSessionId);
        clear();
        resetToPatientTabs(navigation, 'workout');
      } else {
        await result.interrupt();
        showAfterTabs(navigation, 'SessionInterrupted', clientSessionId);
      }
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
      setBusy(false);
    }
  };

  return (
    <Screen
      back="Voltar à sessão"
      title="Encerrar o treino?"
      footer={
        <>
          {error ? <InlineError message={error} /> : null}
          <Button
            secondary
            label="Encerrar sessão"
            disabled={busy || result.saving}
            onPress={exit}
          />
          <Button label="Voltar à sessão" onPress={() => navigation.goBack()} />
        </>
      }
    >
      <Card white>
        <Body>
          {countedRepetitions(session.snapshot) === 0
            ? 'Nenhuma repetição foi contada. Nada será enviado.'
            : 'As repetições contadas até aqui serão enviadas ao seu fisioterapeuta.'}
        </Body>
      </Card>
    </Screen>
  );
}

/** Leaves the finished session with the tabs as the only route behind. */
function showAfterTabs(
  navigation: FrontendNavigation,
  name: 'PatientCompletion' | 'SessionInterrupted',
  clientSessionId: string,
) {
  navigation.reset({
    index: 1,
    routes: [{ name: 'PatientTabs' }, { name, params: { clientSessionId } }],
  });
}

/** Counted repetitions per item; no score and nothing about movement quality. */
function SessionSummary({ session }: { session: ActiveSession | null }) {
  if (!session) {
    return null;
  }
  return (
    <Card white title="Resumo">
      {session.snapshot.items.map(progress => {
        const item = session.workout.items.find(
          entry => entry.id === progress.workout_item_id,
        );
        return (
          <Text key={progress.workout_item_id} style={styles.body}>
            {item ? exerciseName(item) : 'Exercício'}:{' '}
            {progress.completed_repetitions} de{' '}
            {progress.sets * progress.repetitions} repetições
          </Text>
        );
      })}
      <Text style={styles.demo}>
        As repetições foram contadas pelos seus toques.
      </Text>
    </Card>
  );
}

type CardSyncStatus = PublicSessionSyncStatus | 'unknown';

const syncTexts: Record<
  CardSyncStatus,
  {
    badge: string;
    tone: 'neutral' | 'success' | 'warning';
    message: string;
  }
> = {
  pending: {
    badge: 'Aguardando envio',
    tone: 'neutral',
    message:
      'O resultado está salvo neste celular e será enviado quando houver internet.',
  },
  syncing: {
    badge: 'Enviando',
    tone: 'neutral',
    message: 'Enviando o resultado ao seu fisioterapeuta.',
  },
  synced: {
    badge: 'Enviado',
    tone: 'success',
    message: 'Seu fisioterapeuta já pode ver este resultado.',
  },
  retryable_error: {
    badge: 'Não enviado',
    tone: 'warning',
    message:
      'Não foi possível enviar agora. O resultado continua salvo neste celular.',
  },
  permanent_error: {
    badge: 'Não enviado',
    tone: 'warning',
    message:
      'Este resultado não pôde ser enviado. Fale com seu fisioterapeuta.',
  },
  unknown: {
    badge: 'Situação do envio indisponível',
    tone: 'neutral',
    message: 'Não conseguimos confirmar agora se este resultado foi enviado.',
  },
};

const retryableStatuses: CardSyncStatus[] = [
  'pending',
  'retryable_error',
  'unknown',
];

/**
 * Upload status of a finished session. "Enviado" needs proof: the last sync
 * report confirms this ID, or this card saw the result in the local queue
 * and a later successful read no longer has it (only a confirmed send removes
 * it). Without proof, or when the queue could not be read, the status is
 * "unknown" instead of a guess.
 */
export function SessionSyncStatusCard({
  clientSessionId,
}: {
  clientSessionId: UUID;
}) {
  const { pending, syncing, loadError, lastReport, retryNow } =
    useSessionSync();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entry = pending.find(
    item => item.payload.client_session_id === clientSessionId,
  );
  const [seenInQueue, setSeenInQueue] = useState(entry !== undefined);
  useEffect(() => {
    if (entry) {
      setSeenInQueue(true);
    }
  }, [entry]);
  let status: CardSyncStatus =
    selectSessionSyncStatus(clientSessionId, entry, lastReport) ??
    (seenInQueue && !loadError ? 'synced' : 'unknown');
  if (retrying || (status === 'pending' && syncing)) {
    status = 'syncing';
  }
  const text = syncTexts[status];
  const retry = async () => {
    setRetrying(true);
    setError(null);
    try {
      await retryNow(clientSessionId);
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    } finally {
      setRetrying(false);
    }
  };
  return (
    <Card white title="Envio ao fisioterapeuta">
      <View
        accessible
        accessibilityLabel={`${text.badge}. ${text.message}`}
        accessibilityLiveRegion="polite"
        style={sessionStyles.status}
      >
        <Badge label={text.badge} tone={text.tone} />
        <Body>{text.message}</Body>
      </View>
      {error ? <InlineError message={error} /> : null}
      {retryableStatuses.includes(status) ? (
        <Button
          secondary
          icon="history"
          label="Tentar enviar agora"
          onPress={retry}
        />
      ) : null}
    </Card>
  );
}

export function SessionInterruptedScreen() {
  const navigation = useFrontendNavigation();
  const { clientSessionId } = useSessionRoute();
  const { session, clear } = useActiveSession(clientSessionId);
  const leave = (section?: 'workout') => {
    clear();
    resetToPatientTabs(navigation, section);
  };
  return (
    <Screen
      title="Treino interrompido"
      footer={
        <>
          <Button secondary label="Ir para o início" onPress={() => leave()} />
          <Button
            label="Voltar ao meu treino"
            onPress={() => leave('workout')}
          />
        </>
      }
    >
      <Body>O que você fez até aqui foi salvo.</Body>
      <SessionSummary session={session} />
      <SessionSyncStatusCard clientSessionId={clientSessionId} />
      <Body>Fale com seu fisioterapeuta se precisar de orientação.</Body>
    </Screen>
  );
}

export function PatientCompletionScreen() {
  const navigation = useFrontendNavigation();
  const { clientSessionId } = useSessionRoute();
  const { session, clear } = useActiveSession(clientSessionId);
  const leave = (section?: 'progress') => {
    clear();
    resetToPatientTabs(navigation, section);
  };
  return (
    <Screen
      title="Treino concluído"
      footer={
        <>
          <Button label="Voltar ao início" onPress={() => leave()} />
          <Button
            secondary
            label="Ver meu progresso"
            onPress={() => leave('progress')}
          />
        </>
      }
    >
      <View style={styles.center}>
        <Mascot kind="gold" />
      </View>
      <SessionSummary session={session} />
      <SessionSyncStatusCard clientSessionId={clientSessionId} />
    </Screen>
  );
}

const sessionStyles = StyleSheet.create({
  status: { gap: spacing.sm, alignItems: 'flex-start' },
});
