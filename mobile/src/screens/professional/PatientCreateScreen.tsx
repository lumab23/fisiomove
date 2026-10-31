import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { Button, styles } from '../../ui';
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
      subtitle="Dados de exemplo para o protótipo."
      footer={<Button label="Cadastrar e configurar treino" onPress={submit} />}
    >
      <FormField
        label="NOME"
        value={name}
        onChangeText={setName}
        placeholder="Nome completo"
        autoCapitalize="words"
        maxLength={100}
        error={errors.name}
      />
      <FormField
        label="IDENTIFICAÇÃO"
        value={identification}
        onChangeText={setIdentification}
        placeholder="Paciente 002"
        maxLength={40}
        error={errors.identification}
      />
      <FormField
        label="CONTATO"
        value={contact}
        onChangeText={setContact}
        placeholder="(85) 90000-0000"
        keyboardType="phone-pad"
        maxLength={24}
        error={errors.contact}
      />
      <Text style={styles.demo}>
        Use apenas dados fictícios. O cadastro fica na memória deste app.
      </Text>
    </Screen>
  );
}
