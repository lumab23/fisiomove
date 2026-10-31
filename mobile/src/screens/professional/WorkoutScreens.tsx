import { useState } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen, Notice, s } from '../../components/Screen';
import { Body, Button, Card, Link, styles } from '../../ui';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import type { Repetitions } from '../../demo/model';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
export function WorkoutConfigurationScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  const { dispatch } = useDemo();
  const [repetitions, setRepetitions] = useState<Repetitions>(
    patient.repetitions,
  );
  return (
    <Screen
      professional
      back={patient.name}
      title={`Treino de ${patient.name.split(' ')[0]}`}
      subtitle="Exercício atribuído"
      footer={
        <>
          <Button
            label="Salvar alterações"
            onPress={() =>
              navigation.navigate('WorkoutReview', { repetitions })
            }
          />
          <Link
            label="Salvar rascunho"
            onPress={() => {
              dispatch({
                type: 'workout',
                id: patient.id,
                repetitions,
                published: false,
              });
              navigation.navigate('PatientDetails');
            }}
          />
        </>
      }
    >
      <Notice />
      <Card title="Elevação do braço">
        <View style={s.row}>
          <View style={s.column}>
            <Body>Sentado • braço direito</Body>
            <Body>Amplitude conforme avaliação profissional</Body>
          </View>
          <Image
            source={require('../../assets/person.png')}
            resizeMode="contain"
            style={workoutStyles.person}
            accessible={false}
          />
        </View>
      </Card>
      <View style={s.row}>
        <View style={s.column}>
          <Card>
            <Text style={styles.demo}>SÉRIES</Text>
            <Text style={styles.cardTitle}>2</Text>
          </Card>
        </View>
        <View style={s.column}>
          <Card>
            <Text style={styles.demo}>REPETIÇÕES</Text>
            <Text style={styles.cardTitle}>{repetitions}</Text>
          </Card>
        </View>
      </View>
      <Button
        secondary
        label={
          repetitions === 8 ? 'Usar 10 repetições  ›' : 'Usar 8 repetições  ›'
        }
        onPress={() => setRepetitions(repetitions === 8 ? 10 : 8)}
      />
      <Text accessibilityLiveRegion="polite" style={styles.demo}>
        {repetitions} repetições selecionadas. Opções fictícias exibidas no PDF.
      </Text>
    </Screen>
  );
}
export function WorkoutReviewScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  const { dispatch } = useDemo();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'WorkoutReview'>>();
  return (
    <Screen
      professional
      back="Configuração"
      title="Revisar e publicar"
      subtitle={`Treino de ${patient.name}`}
      footer={
        <>
          <Button
            label="Publicar treino (demo)"
            onPress={() => {
              dispatch({
                type: 'workout',
                id: patient.id,
                repetitions: params.repetitions,
                published: true,
              });
              navigation.popTo('PatientDetails');
            }}
          />
          <Link
            label="Voltar para editar"
            onPress={() => navigation.goBack()}
          />
        </>
      }
    >
      <Card title="Elevação de braço sentado">
        <Body>2 séries de {params.repetitions} repetições • braço direito</Body>
        <Body>Amplitude conforme avaliação profissional</Body>
      </Card>
      <Card white title="Disponibilizar ao paciente">
        <Body>
          Ao publicar, o treino ficará visível no fluxo de demonstração do
          paciente. Sessões anteriores mantêm os valores originais.
        </Body>
      </Card>
      <Text style={styles.demo}>
        Publicação apenas local. Não altera catálogo, prescrição ou dados do
        backend.
      </Text>
    </Screen>
  );
}

const workoutStyles = StyleSheet.create({ person: { width: 78, height: 100 } });
