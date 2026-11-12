import { useState } from 'react';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { appDependencies } from '../../app/dependencies';
import { FormField } from '../../components/FormField';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/ScreenStates';
import type { Exercise } from '../../contracts/domain';
import { useResource } from '../../integration/usePatientData';
import { maxPageSize } from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { exerciseLocalization } from '../patient/workoutText';
import { Button, ListGroup, ListRow } from '../../ui';
import { ResourceView } from './shared';

async function loadCatalog() {
  const first = await appDependencies.exercises.list({
    page_size: maxPageSize,
  });
  const items = [...first.items];
  for (let page = 2; page <= first.pages; page += 1) {
    const next = await appDependencies.exercises.list({
      page,
      page_size: maxPageSize,
    });
    items.push(...next.items);
  }
  return { items };
}
const never = () => false;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

/** Choosing an existing catalog item does not import, prescribe or save it. */
export function WorkoutExercisePickerScreen() {
  const navigation = useFrontendNavigation();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'WorkoutExercisePicker'>>();
  const catalog = useResource(loadCatalog, never);
  const [search, setSearch] = useState('');
  return (
    <Screen professional back="Treino" title="Adicionar exercício">
      <FormField
        label="Buscar no catálogo"
        placeholder="Nome em português ou inglês"
        leadingIcon="search"
        hideLabel
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        returnKeyType="search"
      />
      <Button
        secondary
        compact
        label="Buscar na biblioteca de referência"
        onPress={() =>
          navigation.navigate('ExerciseLibrary', { pickFor: params })
        }
        accessibilityHint="Abre a fonte externa para importar um exercício para o catálogo antes de usá-lo neste treino."
      />
      <ResourceView resource={catalog} loadingLabel="Carregando catálogo">
        {({ items }) => {
          const found = items.filter(exercise =>
            normalize(
              `${exercise.name} ${exerciseLocalization(exercise)?.name ?? ''}`,
            ).includes(normalize(search)),
          );
          return found.length ? (
            <ListGroup>
              {found.map((exercise: Exercise) => {
                const translation = exerciseLocalization(exercise);
                const label = translation
                  ? `${translation.name} (original: ${exercise.name})`
                  : exercise.name;
                return (
                  <ListRow
                    key={exercise.id}
                    icon="activity"
                    title={label}
                    description={
                      exercise.source
                        ? 'Exercício do catálogo · Fonte externa'
                        : 'Exercício do catálogo'
                    }
                    accessibilityHint="Adiciona este exercício ao treino para configurar a prescrição."
                    onPress={() =>
                      navigation.popTo(
                        'WorkoutConfiguration',
                        {
                          patientId: params.patientId,
                          workoutId: params.workoutId,
                          picked: {
                            itemKey: params.itemKey,
                            exerciseId: exercise.id,
                          },
                        },
                        { merge: true },
                      )
                    }
                  />
                );
              })}
            </ListGroup>
          ) : (
            <EmptyState
              title={
                items.length
                  ? 'Nenhum exercício encontrado'
                  : 'O catálogo ainda não tem exercícios'
              }
              message={
                items.length
                  ? 'Busque pelo nome em português ou inglês.'
                  : 'Use a biblioteca de referência para importar um exercício para o catálogo.'
              }
            />
          );
        }}
      </ResourceView>
    </Screen>
  );
}
