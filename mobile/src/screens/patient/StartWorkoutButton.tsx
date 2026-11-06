import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Workout } from '../../contracts/domain';
import { usePatientTabNavigation } from '../../navigation/frontendTypes';
import { useSessionSync } from '../../sync/SessionSyncContext';
import { Button } from '../../ui';

/**
 * "Iniciar treino", or "Continuar treino" when this device keeps a draft of
 * the same revision. The draft itself is only created on "Começar exercício".
 */
export function StartWorkoutButton({
  workout,
  inverse = false,
}: {
  workout: Pick<Workout, 'id' | 'current_revision_id'>;
  inverse?: boolean;
}) {
  const navigation = usePatientTabNavigation();
  const { findDraft } = useSessionSync();
  const [hasDraft, setHasDraft] = useState(false);
  const { id: workoutId, current_revision_id: workoutRevisionId } = workout;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      findDraft(workoutId, workoutRevisionId).then(
        draft => active && setHasDraft(draft !== null),
        () => active && setHasDraft(false),
      );
      return () => {
        active = false;
      };
    }, [findDraft, workoutId, workoutRevisionId]),
  );

  return (
    <Button
      inverse={inverse}
      icon="play"
      label={hasDraft ? 'Continuar treino' : 'Iniciar treino'}
      accessibilityHint="Abre a preparação do celular e da câmera"
      onPress={() =>
        navigation.navigate('PatientPreparation', {
          workoutId,
          workoutRevisionId,
        })
      }
    />
  );
}
