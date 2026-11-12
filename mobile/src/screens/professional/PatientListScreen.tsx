import { useState } from 'react';
import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/ScreenStates';
import { FormField } from '../../components/FormField';
import type { Patient } from '../../contracts/domain';
import { usePatients } from '../../integration/useProfessionalData';
import { Button, ListGroup, ListRow } from '../../ui';
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
  return <PatientDirectory mode="patients" />;
}

/** One directory and data source for both professional tabs. */
export function PatientDirectory({
  mode,
}: {
  mode: 'patients' | 'monitoring';
}) {
  const patients = usePatients();
  const { clear } = useScreenMessage();
  const navigation = useFrontendNavigation();
  const [search, setSearch] = useState('');
  useReloadOnReturn(patients.reload);
  return (
    <Screen
      professional
      title={mode === 'patients' ? 'Pacientes' : 'Acompanhamento'}
      footer={
        mode === 'patients' ? (
          <Button
            label="Cadastrar paciente"
            onPress={() => navigation.navigate('PatientCreate')}
          />
        ) : undefined
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
                      accessibilityHint={
                        mode === 'patients'
                          ? `Abre contato e acesso ao aplicativo. ${accessText(patient)}.`
                          : 'Abre treinos e observações do paciente.'
                      }
                      onPress={() => {
                        clear();
                        navigation.navigate(
                          mode === 'patients'
                            ? 'PatientDetails'
                            : 'PatientFollowUp',
                          {
                            patientId: patient.id,
                          },
                        );
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
            </>
          );
        }}
      </ResourceView>
    </Screen>
  );
}
