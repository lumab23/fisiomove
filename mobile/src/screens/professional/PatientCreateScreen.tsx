import { useState } from 'react';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { Button } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import { validatePatient } from '../../demo/model';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
export function PatientCreateScreen() {
  const navigation = useFrontendNavigation();
  const { state, dispatch } = useDemo();
  const [name, setName] = useState('');
  const [identification, setIdentification] = useState('');
  const [contact, setContact] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validatePatient>>({});
  const submit = () => {
    const next = validatePatient(name, identification, contact, state.patients);
    setErrors(next);
    if (Object.keys(next).length) {
      dispatch({
        type: 'message',
        value: 'Confira os campos destacados para continuar.',
      });
      return;
    }
    dispatch({
      type: 'create',
      patient: {
        id: `patient-${Date.now()}`,
        name: name.trim(),
        identification: identification.trim(),
        contact: contact.trim(),
        repetitions: 8,
        published: false,
        note: '',
      },
    });
    navigation.replace('WorkoutConfiguration');
  };
  return (
    <Screen
      back="Fisioterapeuta"
      title="Cadastrar paciente"
      footer={<Button label="Cadastrar e configurar treino" onPress={submit} />}
    >
      <FormField
        label="NOME"
        value={name}
        onChangeText={value => {
          setName(value);
          setErrors(current => ({ ...current, name: undefined }));
        }}
        placeholder="Nome completo"
        autoCapitalize="words"
        maxLength={100}
        error={errors.name}
      />
      <FormField
        label="IDENTIFICAÇÃO"
        value={identification}
        onChangeText={value => {
          setIdentification(value);
          setErrors(current => ({ ...current, identification: undefined }));
        }}
        placeholder="Paciente 002"
        maxLength={40}
        error={errors.identification}
      />
      <FormField
        label="CONTATO"
        value={contact}
        onChangeText={value => {
          setContact(value);
          setErrors(current => ({ ...current, contact: undefined }));
        }}
        placeholder="(85) 90000-0000"
        keyboardType="phone-pad"
        maxLength={24}
        error={errors.contact}
      />
    </Screen>
  );
}
