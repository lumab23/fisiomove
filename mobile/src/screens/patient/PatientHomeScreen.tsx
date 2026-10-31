import { Text, View } from 'react-native';
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
      footer={
        <>
          <Body>
            Se sentir desconforto, pare e siga a orientação do seu
            fisioterapeuta.
          </Body>
          <Link
            label="Ver área profissional (demo)  ›"
            onPress={() => {
              dispatch({ type: 'message', value: '' });
              navigation.navigate('PatientList');
            }}
          />
          <AccountAccess />
          <Text style={styles.demo}>
            Protótipo conceitual • dados locais e fictícios
          </Text>
        </>
      }
    >
      <View style={styles.heading}>
        <Title>Olá, {patient.name.split(' ')[0]}!</Title>
        <Body>Vamos começar seu treino?</Body>
      </View>
      <Notice />
      <Card>
        <Text style={styles.eyebrow}>TREINO RECOMENDADO</Text>
        <Title>Sua atividade de fisioterapia</Title>
        <Body>Orientada pelo seu fisioterapeuta</Body>
        <Mascot kind="home" />
      </Card>
      <Body>
        Faça o treino em casa seguindo as orientações do profissional.
      </Body>
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
