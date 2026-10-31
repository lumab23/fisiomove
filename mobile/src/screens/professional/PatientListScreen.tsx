import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Screen, Notice } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { Body, Button, Card, Link, styles } from '../../ui';
import { useDemo } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
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
          <Body>Selecione um paciente para ver seu treino.</Body>
          <Link
            label="‹  Área do paciente (demo)"
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: 'PatientHome' }] })
            }
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
              <Text style={styles.body}>Abrir ficha e acompanhamento</Text>
            </Card>
          </Pressable>
        ))
      ) : (
        <Card title="Nenhum paciente encontrado">
          <Body>Tente outro nome ou cadastre um novo paciente.</Body>
          <Link label="Limpar busca" onPress={() => setSearch('')} />
        </Card>
      )}
    </Screen>
  );
}
