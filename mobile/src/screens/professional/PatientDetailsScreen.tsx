import { useNativeConfirmation } from '../../components/useNativeConfirmation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type { Patient } from '../../contracts/domain';
import { usePatient } from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
import { colors, fonts, layout, spacing, typography } from '../../theme/theme';
import { Body, Button, Card, Link } from '../../ui';
import { apiErrorMessage, ResourceView, useReloadOnReturn } from './shared';

/** Kept only in this screen's memory and cleared when it loses focus. */
type TemporaryCredential = { email: string; password: string };

const accessErrors: Record<string, string> = {
  patient_access_already_active:
    'O acesso já está ativo. Se o paciente esqueceu a senha, gere uma nova senha provisória.',
  patient_access_not_created:
    'Libere o acesso antes de gerar uma nova senha provisória.',
  patient_email_required: 'Cadastre um e-mail para liberar o acesso.',
  patient_inactive: 'Este cadastro está desativado.',
  email_conflict: 'O e-mail deste paciente já é usado por outra conta.',
};

const deleteErrors: Record<string, string> = {
  patient_has_clinical_records:
    'Não é possível excluir este paciente porque ele já possui histórico clínico.',
};

export function PatientDetailsScreen() {
  const navigation = useFrontendNavigation();
  const { show } = useScreenMessage();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'PatientDetails'>>();
  const { patientId } = params;
  const patient = usePatient(patientId);
  const [credential, setCredential] = useState<TemporaryCredential | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useReloadOnReturn(patient.reload);
  // The card is rendered on top while the button that issued it is further
  // down (and is replaced by a loading state on reload): bring it into view.
  useEffect(() => {
    if (credential) {
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  }, [credential]);
  // The temporary password is shown once: leaving the screen discards it.
  useFocusEffect(useCallback(() => () => setCredential(null), []));
  const name =
    patient.state.status === 'success' ? patient.state.data.full_name : null;

  const confirmRemoval = useNativeConfirmation();
  const removePatient = () => {
    if (deleting) {
      return;
    }
    confirmRemoval({
      title: 'Excluir paciente',
      message:
        'Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.',
      destructive: true,
      onConfirm: async () => {
        setDeleting(true);
        try {
          await appDependencies.patients.delete(patientId);
          show('Paciente excluído.', 'success');
          navigation.reset({
            index: 0,
            routes: [{ name: 'PatientList' }],
          });
        } catch (cause) {
          show(apiErrorMessage(cause, deleteErrors), 'error');
          setDeleting(false);
        }
      },
    });
  };

  return (
    <Screen
      professional
      back="Pacientes"
      title={name ?? 'Paciente'}
      scrollRef={scroll}
    >
      {credential ? (
        <TemporaryPasswordCard
          credential={credential}
          onDone={() => setCredential(null)}
        />
      ) : null}
      <ResourceView resource={patient} loadingLabel="Carregando paciente">
        {data => (
          <>
            <Card white>
              <View style={contactStyles.header}>
                <Text accessibilityRole="header" style={contactStyles.title}>
                  Contato
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Editar dados do paciente"
                  accessibilityHint="Abre a tela para editar nome, e-mail e telefone."
                  onPress={() =>
                    navigation.navigate('PatientEdit', { patientId })
                  }
                  style={({ pressed }) => [
                    contactStyles.iconButton,
                    pressed && contactStyles.pressed,
                  ]}
                >
                  <Icon name="edit" size={20} color={colors.primary} />
                </Pressable>
              </View>
              <Body>{data.email ?? 'Sem e-mail cadastrado'}</Body>
              <Body>{data.phone ?? 'Sem telefone cadastrado'}</Body>
            </Card>
            <AccessCard
              patient={data}
              onIssued={value => {
                setCredential(value);
                patient.reload();
              }}
            />
            <View style={contactStyles.deleteRow}>
              <Link
                label={deleting ? 'Excluindo…' : 'Excluir paciente'}
                onPress={removePatient}
              />
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  );
}

function AccessCard({
  patient,
  onIssued,
}: {
  patient: Patient;
  onIssued: (credential: TemporaryCredential) => void;
}) {
  const { show } = useScreenMessage();
  const [busy, setBusy] = useState(false);
  const confirmReset = useNativeConfirmation();
  const run = async (operation: 'activate' | 'reset') => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result =
        operation === 'activate'
          ? await appDependencies.patients.activateAccess(patient.id)
          : await appDependencies.patients.resetTemporaryPassword(patient.id);
      // The global feedback host announces the confirmation.
      show(
        operation === 'activate'
          ? 'Acesso liberado. A senha provisória está no topo da tela.'
          : 'Nova senha provisória gerada. Ela está no topo da tela.',
        'success',
      );
      onIssued({ email: result.email, password: result.temporary_password });
    } catch (cause) {
      show(apiErrorMessage(cause, accessErrors), 'error');
    } finally {
      setBusy(false);
    }
  };
  if (!patient.is_active) {
    return (
      <Card white title="Acesso ao aplicativo">
        <Body>Cadastro desativado. O acesso ao aplicativo está bloqueado.</Body>
      </Card>
    );
  }
  if (!patient.email) {
    return (
      <Card white title="Acesso ao aplicativo">
        <Body>
          Para liberar o acesso, o paciente precisa ter um e-mail cadastrado.
        </Body>
      </Card>
    );
  }
  const active = patient.has_access && patient.access_is_active;
  return (
    <Card white title="Acesso ao aplicativo">
      {!active ? (
        <>
          <Body>
            O paciente ainda não pode entrar no aplicativo. Ao liberar, uma
            senha provisória será mostrada uma única vez.
          </Body>
          <Button
            label={busy ? 'Liberando…' : 'Liberar acesso ao app'}
            disabled={busy}
            onPress={() => run('activate')}
          />
        </>
      ) : (
        <>
          <Body>
            {patient.must_change_password
              ? 'Acesso liberado. Aguardando o paciente entrar e criar a própria senha.'
              : 'Acesso ativo.'}
          </Body>
          <Body>
            Se o paciente esqueceu a senha, gere uma nova senha provisória.
          </Body>
          <Button
            secondary
            label="Redefinir senha provisória"
            disabled={busy}
            onPress={() =>
              confirmReset({
                title: 'Redefinir senha provisória?',
                message:
                  'A senha atual do paciente deixará de funcionar e ele precisará criar uma nova no próximo acesso. Deseja continuar?',
                destructive: true,
                onConfirm: () => run('reset'),
              })
            }
          />
        </>
      )}
    </Card>
  );
}

function TemporaryPasswordCard({
  credential,
  onDone,
}: {
  credential: TemporaryCredential;
  onDone: () => void;
}) {
  return (
    <Card white title="Senha provisória">
      <Body>
        Entregue estes dados ao paciente pessoalmente ou por um canal seguro. A
        senha aparece só agora: ao sair desta tela, não será possível vê-la de
        novo.
      </Body>
      <Body>{`E-mail de acesso: ${credential.email}`}</Body>
      <Text
        selectable
        accessibilityLabel={`Senha provisória: ${credential.password.split('').join(' ')}`}
        style={passwordStyles.value}
      >
        {credential.password}
      </Text>
      <Body>No primeiro acesso, o paciente vai criar a própria senha.</Body>
      <Button label="Já entreguei a senha" onPress={onDone} />
    </Card>
  );
}

const passwordStyles = StyleSheet.create({
  value: {
    color: colors.text,
    ...typography.title,
    fontFamily: fonts.bold,
  },
});

const contactStyles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    ...typography.title,
    fontFamily: fonts.bold,
    flex: 1,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: layout.compactControlHeight / 2,
    height: layout.compactControlHeight,
    justifyContent: 'center',
    width: layout.compactControlHeight,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  deleteRow: { alignItems: 'center', marginTop: spacing.sm },
});
