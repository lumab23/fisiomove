import { useState } from 'react';
import { Pressable } from 'react-native';
import { Screen, Notice } from '../../components/Screen';
import { EmptyState } from '../../components/ScreenStates';
import { FormField } from '../../components/FormField';
import { Body, Button, Card, Link } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import {
  resetToPatientTabs,
  useFrontendNavigation,
} from '../../navigation/frontendTypes';
export function PatientListScreen() {
  const { state, dispatch } = useDemo();
  const navigation = useFrontendNavigation();
  const [search, setSearch] = useState('');
  const patients = state.patients.filter(patient =>
    `${patient.name} ${patient.identification}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase().trim()),
  );
  return (
    <Screen
      professional
      title="Pacientes"
      subtitle={`${state.patients.length} paciente${state.patients.length === 1 ? '' : 's'} cadastrado${state.patients.length === 1 ? '' : 's'}`}
      footer={
        <>
          <Button
            label="Cadastrar paciente"
            onPress={() => navigation.navigate('PatientCreate')}
          />
          <Link
            label="‹  Área do paciente"
            onPress={() => resetToPatientTabs(navigation)}
          />
        </>
      }
    >
      <Notice />
      <FormField
        label="Buscar paciente"
        value={search}
        onChangeText={setSearch}
        placeholder="Nome ou identificação"
        autoCorrect={false}
      />
      {patients.length ? (
        patients.map(patient => (
          <Pressable
            key={patient.id}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ficha de ${patient.name}`}
            onPress={() => {
              dispatch({ type: 'select', id: patient.id });
              dispatch({ type: 'message', value: '' });
              navigation.navigate('PatientDetails');
            }}
          >
            <Card title={`${patient.name}  ›`}>
              <Body>
                {patient.published
                  ? '1 exercício atribuído'
                  : 'Treino em rascunho'}
              </Body>
            </Card>
          </Pressable>
        ))
      ) : (
        <EmptyState
          title="Nenhum paciente encontrado"
          message="Ajuste a busca ou cadastre um paciente."
          actionLabel="Limpar busca"
          onAction={() => setSearch('')}
        />
      )}
    </Screen>
  );
}
