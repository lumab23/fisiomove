import { Screen } from '../../components/Screen';
import { useAccount } from '../../navigation/AccountContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { ListGroup, ListRow } from '../../ui';
import { notesTitle } from './PatientNotesScreen';

/** Patient settings tab, aligned with the professional settings layout. */
export function PatientSettingsScreen() {
  const navigation = useFrontendNavigation();
  const { signOut } = useAccount();
  return (
    <Screen tab title="Configurações">
      <ListGroup>
        <ListRow
          icon="user"
          title="Meu perfil"
          description="Veja suas informações"
          accessibilityHint="Abre suas informações pessoais"
          onPress={() => navigation.navigate('PatientSelfProfile')}
        />
        <ListRow
          icon="user"
          title="Meu fisioterapeuta"
          description="Nome do profissional vinculado a você"
          accessibilityHint="Abre as informações do seu fisioterapeuta"
          onPress={() => navigation.navigate('PhysiotherapistInfo')}
        />
        <ListRow
          icon="message"
          title={notesTitle}
          accessibilityHint="Abre os recados que seu fisioterapeuta deixou para você"
          onPress={() => navigation.navigate('PatientNotes')}
        />
        {signOut ? (
          <ListRow icon="logOut" title="Sair da conta" onPress={signOut} />
        ) : null}
      </ListGroup>
    </Screen>
  );
}
