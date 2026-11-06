import { useState } from 'react';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { InlineError } from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { PhysiotherapistProfile } from '../../contracts/domain';
import { useOwnPhysiotherapistProfile } from '../../integration/useProfessionalData';
import { useAccount } from '../../navigation/AccountContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { Body, Button, Card } from '../../ui';
import { apiErrorMessage, ResourceView } from './shared';

/** Limits of `PhysiotherapistProfileUpdate.full_name` (API contract). */
const nameLength = { min: 2, max: 200 } as const;

export function validateProfessionalName(value: string): string | null {
  const name = value.trim();
  if (name.length < nameLength.min) {
    return 'Informe o nome com pelo menos 2 letras.';
  }
  if (name.length > nameLength.max) {
    return 'O nome pode ter no máximo 200 caracteres.';
  }
  return null;
}

/** Own display name: the only field of the physiotherapist profile (Q-P5). */
export function ProfessionalProfileScreen() {
  const profile = useOwnPhysiotherapistProfile();
  return profile.state.status === 'success' ? (
    <ProfileForm profile={profile.state.data} />
  ) : (
    <Screen professional back="Configurações" title="Meu perfil">
      <ResourceView resource={profile} loadingLabel="Carregando seu perfil">
        {() => null}
      </ResourceView>
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: PhysiotherapistProfile }) {
  const navigation = useFrontendNavigation();
  const { show } = useScreenMessage();
  const { email } = useAccount();
  const [name, setName] = useState(profile.full_name ?? '');
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) {
      return;
    }
    const invalid = validateProfessionalName(name);
    setError(invalid ?? undefined);
    setFailure('');
    if (invalid) {
      return;
    }
    setSaving(true);
    try {
      await appDependencies.profile.updatePhysiotherapistProfile({
        full_name: name.trim(),
      });
      show('Nome salvo.');
      navigation.goBack();
    } catch (cause) {
      setFailure(apiErrorMessage(cause));
      setSaving(false);
    }
  };
  return (
    <Screen
      professional
      back="Configurações"
      title="Meu perfil"
      footer={
        <Button
          label={saving ? 'Salvando…' : 'Salvar nome'}
          disabled={saving}
          onPress={save}
        />
      }
    >
      {failure ? <InlineError message={failure} /> : null}
      {email ? (
        <Card white title="Conta">
          <Body>{email}</Body>
        </Card>
      ) : null}
      <Body>
        {profile.full_name
          ? 'Este é o nome que seus pacientes veem no aplicativo.'
          : 'Você ainda não informou seu nome. Enquanto isso, seus pacientes não veem o nome do fisioterapeuta.'}
      </Body>
      <FormField
        label="Nome de exibição"
        value={name}
        onChangeText={value => {
          setName(value);
          setError(undefined);
        }}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        error={error}
      />
    </Screen>
  );
}
