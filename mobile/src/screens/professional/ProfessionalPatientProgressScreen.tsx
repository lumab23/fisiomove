import { useMemo } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/ScreenStates';
import type { UUID } from '../../contracts/common';
import { currentWeek } from '../../integration/usePatientData';
import {
  usePatient,
  usePatientProgress,
  usePatientSessions,
} from '../../integration/useProfessionalData';
import { type FrontendStackParamList } from '../../navigation/frontendTypes';
import { Body, Card, ListGroup, SectionTitle } from '../../ui';
import { SessionRow } from '../patient/SessionRow';
import { ResourceView, useReloadOnReturn } from './shared';

const recentSessions = 10;

function minutes(ms: number) {
  const value = Math.round(ms / 60000);
  return `${value} ${value === 1 ? 'minuto' : 'minutos'}`;
}

export function ProfessionalPatientProgressScreen() {
  const { params } =
    useRoute<
      RouteProp<FrontendStackParamList, 'ProfessionalPatientProgress'>
    >();
  return <Monitoring patientId={params.patientId} />;
}

function Monitoring({ patientId }: { patientId: UUID }) {
  const patient = usePatient(patientId);
  // Current week (Q-P7): presentation choice, not a clinical rule.
  const week = useMemo(() => currentWeek(new Date()), []);
  const progress = usePatientProgress(patientId, week);
  const sessions = usePatientSessions(patientId, recentSessions);
  useReloadOnReturn(patient.reload, progress.reload, sessions.reload);
  const name =
    patient.state.status === 'success' ? patient.state.data.full_name : null;
  return (
    <Screen
      professional
      back={name ?? 'Paciente'}
      title="Sessões e progresso"
      subtitle={name ?? undefined}
    >
      <SectionTitle>Esta semana</SectionTitle>
      <ResourceView
        resource={progress}
        loadingLabel="Carregando progresso da semana"
        empty={
          <EmptyState
            title="Nenhuma sessão nesta semana"
            message="Quando o paciente fizer o treino, o resumo aparece aqui."
          />
        }
      >
        {summary => (
          <Card white>
            <Body>{`Sessões concluídas: ${summary.completed_sessions}`}</Body>
            <Body>{`Sessões interrompidas: ${summary.interrupted_sessions}`}</Body>
            <Body>
              {`Repetições: ${summary.performed_repetitions} de ${summary.prescribed_repetitions} prescritas`}
            </Body>
            <Body>{`Tempo ativo: ${minutes(summary.active_duration_ms)}`}</Body>
          </Card>
        )}
      </ResourceView>
      <SectionTitle>Sessões recentes</SectionTitle>
      <ResourceView
        resource={sessions}
        loadingLabel="Carregando sessões"
        empty={
          <EmptyState
            title="Nenhuma sessão registrada"
            message="As sessões aparecem aqui depois que o paciente treina com o aplicativo."
          />
        }
      >
        {page => (
          <ListGroup>
            {page.items.map(session => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ListGroup>
        )}
      </ResourceView>
    </Screen>
  );
}
