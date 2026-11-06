import { Screen } from '../../components/Screen';
import { LinkedPhysiotherapistCard } from './PatientProfileScreen';

/** Name of the linked physiotherapist; the API exposes nothing else. */
export function PhysiotherapistInfoScreen() {
  return (
    <Screen back="Perfil" title="Meu fisioterapeuta">
      <LinkedPhysiotherapistCard />
    </Screen>
  );
}
