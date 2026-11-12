import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { Patient, PatientUpdate } from '../../contracts/domain';
import { usePatient } from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { spacing } from '../../theme/theme';
import { Body, Button } from '../../ui';
import { apiErrorMessage, ResourceView } from './shared';

type Errors = { name?: string; email?: string; phone?: string };

const nameLength = { min: 2, max: 200 } as const;

const updateErrors: Record<string, string> = {
  email_conflict: 'Este e-mail já é usado por outra conta.',
  patient_email_required_for_access:
    'O e-mail não pode ser removido enquanto o paciente tiver acesso ao aplicativo.',
};

export function validatePatientEditForm(
  name: string,
  email: string,
  phone: string,
  options: { emailRequired: boolean },
): Errors {
  const errors: Errors = {};
  const trimmedName = name.trim();
  if (
    trimmedName.length < nameLength.min ||
    trimmedName.length > nameLength.max
  ) {
    errors.name = 'Informe o nome completo.';
  }
  const trimmedEmail = email.trim();
  if (options.emailRequired && !trimmedEmail) {
    errors.email =
      'O e-mail não pode ser removido enquanto o paciente tiver acesso ao aplicativo.';
  } else if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Confira o e-mail. Exemplo: nome@provedor.com';
  }
  const phoneLength = phone.trim().length;
  if (phoneLength && (phoneLength < 3 || phoneLength > 32)) {
    errors.phone = 'Confira o telefone.';
  }
  return errors;
}

export function PatientEditScreen() {
  const navigation = useFrontendNavigation();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'PatientEdit'>>();
  const patient = usePatient(params.patientId);

  return (
    <Screen professional back="Paciente" title="Editar paciente">
      <ResourceView resource={patient} loadingLabel="Carregando paciente">
        {data => (
          <PatientEditForm
            patient={data}
            onCancel={() => navigation.goBack()}
            onSaved={() => navigation.goBack()}
          />
        )}
      </ResourceView>
    </Screen>
  );
}

function PatientEditForm({
  patient,
  onCancel,
  onSaved,
}: {
  patient: Patient;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { show } = useScreenMessage();
  const [name, setName] = useState(patient.full_name ?? '');
  const [email, setEmail] = useState(patient.email ?? '');
  const [phone, setPhone] = useState(patient.phone ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Keep fields in sync if the patient changes while the screen is mounted.
  useEffect(() => {
    setName(patient.full_name ?? '');
    setEmail(patient.email ?? '');
    setPhone(patient.phone ?? '');
  }, [patient.id, patient.full_name, patient.email, patient.phone]);

  const save = async () => {
    if (saving) {
      return;
    }
    const next = validatePatientEditForm(name, email, phone, {
      emailRequired: patient.has_access,
    });
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    const payload: PatientUpdate = {
      full_name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    setSaving(true);
    try {
      await appDependencies.patients.update(patient.id, payload);
      show('Dados do paciente atualizados.', 'success');
      onSaved();
    } catch (cause) {
      show(apiErrorMessage(cause, updateErrors), 'error');
      setSaving(false);
    }
  };

  return (
    <View style={s.form}>
      <Body>Atualize as informações de contato do paciente.</Body>
      <FormField
        label="Nome completo"
        value={name}
        onChangeText={value => {
          setName(value);
          setErrors(current => ({ ...current, name: undefined }));
        }}
        autoCapitalize="words"
        maxLength={200}
        editable={!saving}
        error={errors.name}
      />
      <FormField
        label="E-mail"
        value={email}
        onChangeText={value => {
          setEmail(value);
          setErrors(current => ({ ...current, email: undefined }));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={254}
        editable={!saving}
        error={errors.email}
        hint={
          patient.has_access
            ? 'Este e-mail também é usado no acesso ao aplicativo.'
            : 'Opcional. Necessário para liberar o acesso ao aplicativo.'
        }
      />
      <FormField
        label="Telefone"
        value={phone}
        onChangeText={value => {
          setPhone(value);
          setErrors(current => ({ ...current, phone: undefined }));
        }}
        keyboardType="phone-pad"
        maxLength={32}
        editable={!saving}
        error={errors.phone}
        hint="Opcional."
      />
      <View style={s.actions}>
        <View style={s.action}>
          <Button
            secondary
            label="Cancelar"
            disabled={saving}
            onPress={onCancel}
          />
        </View>
        <View style={s.action}>
          <Button
            label={saving ? 'Salvando…' : 'Salvar alterações'}
            disabled={saving}
            onPress={save}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  form: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { flex: 1 },
});
