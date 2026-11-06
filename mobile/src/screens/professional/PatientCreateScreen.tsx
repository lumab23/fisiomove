import { useState } from 'react';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { InlineError } from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { PatientCreate } from '../../contracts/domain';
import { Body, Button } from '../../ui';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { apiErrorMessage } from './shared';

type Errors = { name?: string; email?: string; phone?: string };

/** Mirrors the API limits (`PatientCreate`); the server still validates. */
export function validatePatientForm(
  name: string,
  email: string,
  phone: string,
): Errors {
  const errors: Errors = {};
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 200) {
    errors.name = 'Informe o nome completo.';
  }
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Confira o e-mail. Exemplo: nome@provedor.com';
  }
  const phoneLength = phone.trim().length;
  if (phoneLength && (phoneLength < 3 || phoneLength > 32)) {
    errors.phone = 'Confira o telefone.';
  }
  return errors;
}

export function PatientCreateScreen() {
  const navigation = useFrontendNavigation();
  const { show } = useScreenMessage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const next = validatePatientForm(name, email, phone);
    setErrors(next);
    setFailure('');
    if (Object.keys(next).length || saving) {
      return;
    }
    const payload: PatientCreate = {
      full_name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    setSaving(true);
    try {
      const patient = await appDependencies.patients.create(payload);
      show('Paciente cadastrado.');
      navigation.replace('PatientDetails', { patientId: patient.id });
    } catch (cause) {
      setFailure(
        apiErrorMessage(cause, {
          email_conflict: 'Este e-mail já é usado por outra conta.',
        }),
      );
      setSaving(false);
    }
  };
  return (
    <Screen
      professional
      back="Pacientes"
      title="Cadastrar paciente"
      footer={
        <Button
          label={saving ? 'Cadastrando…' : 'Cadastrar paciente'}
          disabled={saving}
          onPress={submit}
        />
      }
    >
      <Body>
        O e-mail é opcional agora, mas é necessário para liberar o acesso ao
        aplicativo.
      </Body>
      {failure ? <InlineError message={failure} /> : null}
      <FormField
        label="Nome completo"
        value={name}
        onChangeText={value => {
          setName(value);
          setErrors(current => ({ ...current, name: undefined }));
        }}
        autoCapitalize="words"
        maxLength={200}
        error={errors.name}
      />
      <FormField
        label="E-mail (opcional)"
        value={email}
        onChangeText={value => {
          setEmail(value);
          setErrors(current => ({ ...current, email: undefined }));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={254}
        error={errors.email}
      />
      <FormField
        label="Telefone (opcional)"
        value={phone}
        onChangeText={value => {
          setPhone(value);
          setErrors(current => ({ ...current, phone: undefined }));
        }}
        keyboardType="phone-pad"
        maxLength={32}
        error={errors.phone}
      />
    </Screen>
  );
}
