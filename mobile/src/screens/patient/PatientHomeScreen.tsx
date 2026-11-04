import { View } from 'react-native';
import { AccountAccess } from '../../demo/AccountAccess';
import { Screen, Notice } from '../../components/Screen';
import { Body, Button, Card, Link, Mascot, styles, Title } from '../../ui';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import { useFrontendNavigation } from '../../navigation/frontendTypes';

export function PatientHomeScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  const { dispatch } = useDemo();
  return (
    <Screen
      title="Início"
      footer={
        <>
          <Body>
            Se sentir desconforto, pare e siga a orientação do fisioterapeuta.
          </Body>
          <Link
            label="Área profissional  ›"
            onPress={() => {
              dispatch({ type: 'message', value: '' });
              navigation.navigate('PatientList');
            }}
          />
          <AccountAccess />
        </>
      }
    >
      <View style={styles.heading}>
        <Title>Olá, {patient.name.split(' ')[0]}!</Title>
      </View>
      <Notice />
      <Card>
        <Title>Treino recomendado</Title>
        <Mascot kind="home" />
      </Card>
      <Button
        label="Iniciar treino"
        onPress={() => navigation.navigate('PatientWorkout')}
      />
      <Link
        label="Histórico e progresso  ›"
        onPress={() => navigation.navigate('PatientProgress')}
      />
    </Screen>
  );
}
