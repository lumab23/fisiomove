import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { demoPhysiotherapist } from '../../demo/model';
import { colors, fonts, spacing } from '../../theme/theme';
import { Badge, ListGroup, ListRow, styles } from '../../ui';
import { Avatar } from './PatientProfileScreen';

export function PhysiotherapistInfoScreen() {
  return (
    <Screen back="Perfil" title="Meu fisioterapeuta">
      <View style={info.header}>
        <Avatar name={demoPhysiotherapist.name} size={88} />
        <Text accessibilityRole="header" style={info.name}>
          {demoPhysiotherapist.name}
        </Text>
        <Badge label="Dados de exemplo" />
      </View>
      <ListGroup>
        <ListRow
          icon="physio"
          title="Especialidade"
          description={demoPhysiotherapist.specialty}
        />
        <ListRow
          icon="check"
          title="Registro profissional"
          description={demoPhysiotherapist.registry}
        />
        <ListRow
          icon="info"
          title="Sobre o acompanhamento"
          description={demoPhysiotherapist.about}
        />
      </ListGroup>
      <Text style={styles.demo}>
        Os dados reais do profissional aparecerão aqui quando forem cadastrados
        na clínica.
      </Text>
    </Screen>
  );
}

const info = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm },
  name: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
});
