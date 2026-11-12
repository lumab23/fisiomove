import { Screen } from '../../components/Screen';
import { LinkedPhysiotherapistCard } from './PatientProfileScreen';

/** Name of the linked physiotherapist; the API exposes nothing else. */
export function PhysiotherapistInfoScreen() {
  return (
    <Screen back="Configurações" title="Meu fisioterapeuta">
      <LinkedPhysiotherapistCard />
    </Screen>
  );
}
