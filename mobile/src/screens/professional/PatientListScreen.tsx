import { useState } from 'react';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/ScreenStates';
import { FormField } from '../../components/FormField';
import type { Patient } from '../../contracts/domain';
import { usePatients } from '../../integration/useProfessionalData';
import { Body, Button, ListGroup, ListRow } from '../../ui';
import { useScreenMessage } from '../../components/ScreenMessage';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { ResourceView, useReloadOnReturn } from './shared';

function accessText(patient: Patient) {
  if (!patient.is_active) {
    return 'Cadastro desativado';
  }
  if (!patient.has_access || !patient.access_is_active) {
    return 'Acesso ao app não liberado';
  }
  return patient.must_change_password
    ? 'Aguardando o primeiro acesso'
    : 'Acesso ao app ativo';
}

export function PatientListScreen() {
  const patients = usePatients();
  const { clear } = useScreenMessage();
  const navigation = useFrontendNavigation();
  const [search, setSearch] = useState('');
  useReloadOnReturn(patients.reload);
  const total =
    patients.state.status === 'success' || patients.state.status === 'empty'
      ? patients.state.data.total
      : null;
  return (
    <Screen
      professional
      title="Pacientes"
      subtitle={
        total === null
          ? undefined
          : `${total} paciente${total === 1 ? '' : 's'} cadastrado${total === 1 ? '' : 's'}`
      }
      footer={
        <Button
          label="Cadastrar paciente"
          onPress={() => navigation.navigate('PatientCreate')}
        />
      }
    >
      <ResourceView
        resource={patients}
        loadingLabel="Carregando pacientes"
        empty={
          <EmptyState
            title="Nenhum paciente cadastrado"
            message="Cadastre um paciente para montar o treino e liberar o acesso ao aplicativo."
          />
        }
      >
        {page => {
          const term = search.toLocaleLowerCase('pt-BR').trim();
          const found = page.items.filter(patient =>
            `${patient.full_name} ${patient.email ?? ''}`
              .toLocaleLowerCase('pt-BR')
              .includes(term),
          );
          return (
            <>
              <FormField
                label="Buscar paciente"
                value={search}
                onChangeText={setSearch}
                placeholder="Nome ou e-mail"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {found.length ? (
                <ListGroup>
                  {found.map(patient => (
                    <ListRow
                      key={patient.id}
                      icon="user"
                      title={patient.full_name}
                      description={accessText(patient)}
                      accessibilityHint={`Abre a ficha. ${accessText(patient)}.`}
                      onPress={() => {
                        clear();
                        navigation.navigate('PatientDetails', {
                          patientId: patient.id,
                        });
                      }}
                    />
                  ))}
                </ListGroup>
              ) : (
                <EmptyState
                  title="Nenhum paciente encontrado"
                  message="Confira a busca ou limpe o campo para ver todos."
                  actionLabel="Limpar busca"
                  onAction={() => setSearch('')}
                />
              )}
              {page.total > page.items.length ? (
                <Body>
                  {`Mostrando os ${page.items.length} cadastros mais recentes de ${page.total}.`}
                </Body>
              ) : null}
            </>
          );
        }}
      </ResourceView>
    </Screen>
  );
}
