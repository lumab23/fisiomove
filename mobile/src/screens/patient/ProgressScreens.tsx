import { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, s } from '../../components/Screen';
import { Body, Button, Card, Companion, Link, styles } from '../../ui';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { ProgressEmpty } from './SessionScreens';
export function PatientProgressScreen() {
  const navigation = useFrontendNavigation();
  const { state } = useDemo();
  const patient = useDemoPatient();
  const last = state.sessions.find(session => session.patientId === patient.id);
  return (
    <Screen
      back="Voltar"
      title="Seu progresso"
      subtitle="Resumo da sessão demonstrada."
      footer={
        <>
          <Link
            label="Ver histórico de sessões  ›"
            onPress={() => navigation.navigate('PatientHistory')}
          />
          <Button
            label="Voltar ao início"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: 'PatientHome' }] })
            }
          />
          <Text style={styles.demo}>
            Pontos não aumentam as repetições prescritas.
          </Text>
        </>
      }
    >
      {last ? (
        <>
          <Card title="Última sessão">
            <Body>Elevação de braço sentado</Body>
            <Body>
              {last.total} repetições simuladas •{' '}
              {last.completed
                ? `2 séries de ${last.repetitions}`
                : 'sessão interrompida'}
            </Body>
          </Card>
          <Card
            white
            title={
              last.completed
                ? 'Meta do treino concluída'
                : 'Sessão não concluída'
            }
          >
            <Body>Conquistas refletem seu progresso individual.</Body>
          </Card>
          <Companion>
            {last.completed ? 'Você está evoluindo!' : 'Um passo de cada vez.'}
          </Companion>
        </>
      ) : (
        <ProgressEmpty />
      )}
    </Screen>
  );
}
export function PatientHistoryScreen() {
  const { state } = useDemo();
  const patient = useDemoPatient();
  const [filter, setFilter] = useState<'all' | 'completed' | 'interrupted'>(
    'all',
  );
  const sessions = state.sessions.filter(
    session =>
      session.patientId === patient.id &&
      (filter === 'all' || session.completed === (filter === 'completed')),
  );
  return (
    <Screen
      back="Progresso"
      title="Histórico de sessões"
      subtitle="Resultados simulados deste dispositivo."
    >
      <View style={s.row}>
        {(
          [
            ['all', 'Todas'],
            ['completed', 'Concluídas'],
            ['interrupted', 'Interrompidas'],
          ] as const
        ).map(([value, label]) => (
          <View key={value} style={s.column}>
            <Button
              secondary={filter !== value}
              label={label}
              onPress={() => setFilter(value)}
            />
          </View>
        ))}
      </View>
      {sessions.length ? (
        sessions.map(session => (
          <Card
            key={session.id}
            white
            title={
              session.completed ? 'Treino concluído' : 'Treino interrompido'
            }
          >
            <Text style={styles.eyebrow}>
              {new Date(session.date).toLocaleString('pt-BR', {
                timeZone: 'America/Fortaleza',
              })}
            </Text>
            <Body>Elevação de braço sentado</Body>
            <Body>
              {session.total} repetições • meta: 2 séries de{' '}
              {session.repetitions}
            </Body>
          </Card>
        ))
      ) : (
        <Card title="Nenhuma sessão neste filtro">
          <Body>Teste um treino ou escolha outro filtro.</Body>
        </Card>
      )}
    </Screen>
  );
}
