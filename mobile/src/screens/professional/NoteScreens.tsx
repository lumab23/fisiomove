import { useState } from 'react';
import { Text } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { Body, Button, Card, Companion, Link, styles } from '../../ui';
import { useDemo, useDemoPatient } from '../../demo/DemoContext';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
} from '../../navigation/frontendTypes';
export function NoteEditorScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  const [text, setText] = useState(patient.note);
  const [error, setError] = useState('');
  const review = () => {
    if (!text.trim()) {
      setError('Escreva uma orientação antes de revisar.');
      return;
    }
    navigation.navigate('NoteReview', { text: text.trim() });
  };
  return (
    <Screen
      professional
      back={patient.name}
      title="Escrever observação"
      subtitle={`Para ${patient.name}`}
      footer={<Button label="Revisar observação" onPress={review} />}
    >
      <Card>
        <FormField
          label="Sua orientação"
          value={text}
          onChangeText={value => {
            setText(value);
            setError('');
          }}
          placeholder="Toque aqui para escrever"
          multiline
          maxLength={1000}
          error={error}
        />
        <Text style={styles.demo}>{text.length}/1000 caracteres</Text>
        <Link
          label="Usar exemplo do PDF"
          onPress={() => {
            setText('Mantenha o braço dentro do limite orientado.');
            setError('');
          }}
        />
      </Card>
      <Companion>Vamos escrever?</Companion>
    </Screen>
  );
}
export function NoteReviewScreen() {
  const navigation = useFrontendNavigation();
  const patient = useDemoPatient();
  const { dispatch } = useDemo();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'NoteReview'>>();
  return (
    <Screen
      professional
      back={patient.name}
      title="Revisar observação"
      subtitle={`Para ${patient.name}`}
      footer={
        <>
          <Button
            label="Salvar observação"
            onPress={() => {
              dispatch({ type: 'note', id: patient.id, note: params.text });
              navigation.popTo('PatientDetails');
            }}
          />
          <Link label="Editar texto" onPress={() => navigation.goBack()} />
        </>
      }
    >
      <Card title="Orientação ao paciente">
        <Body>{params.text}</Body>
        <Text style={styles.demo}>Confira o texto antes de salvar.</Text>
      </Card>
      <Companion>Confira a orientação.</Companion>
    </Screen>
  );
}
