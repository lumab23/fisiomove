import { Screen } from '../../components/Screen';
import { useAccount } from '../../navigation/AccountContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';
import { ListGroup, ListRow } from '../../ui';

/** Third tab of the physiotherapist: profile, reference library, sign out. */
export function ProfessionalSettingsScreen() {
  const navigation = useFrontendNavigation();
  const { signOut } = useAccount();
  return (
    <Screen professional title="Configurações">
      <ListGroup>
        <ListRow
          icon="user"
          title="Meu perfil"
          description="Nome que seus pacientes veem"
          onPress={() => navigation.navigate('ProfessionalProfile')}
        />
        <ListRow
          icon="info"
          title="Biblioteca de referência"
          description="Exercícios de fonte externa para adicionar ao catálogo"
          onPress={() => navigation.navigate('ExerciseLibrary')}
        />
        {signOut ? (
          <ListRow icon="logOut" title="Sair da conta" onPress={signOut} />
        ) : null}
      </ListGroup>
    </Screen>
  );
}
