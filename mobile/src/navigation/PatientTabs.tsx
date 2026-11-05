import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from '../components/Icon';
import { PatientExercisesScreen } from '../screens/patient/PatientExercisesScreen';
import { PatientHomeScreen } from '../screens/patient/PatientHomeScreen';
import { PatientProfileScreen } from '../screens/patient/PatientProfileScreen';
import { colors, fonts, radii } from '../theme/theme';
import type { PatientTabParamList } from './frontendTypes';

const Tab = createBottomTabNavigator<PatientTabParamList>();
const tabs: Record<
  keyof PatientTabParamList,
  { label: string; icon: IconName; component: React.ComponentType }
> = {
  PatientHome: { label: 'Início', icon: 'home', component: PatientHomeScreen },
  PatientExercises: {
    label: 'Exercícios',
    icon: 'activity',
    component: PatientExercisesScreen,
  },
  PatientProfile: {
    label: 'Perfil',
    icon: 'user',
    component: PatientProfileScreen,
  },
};

export function PatientTabs() {
  return (
    <Tab.Navigator
      backBehavior="firstRoute"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarLabel: tabs[route.name].label,
        tabBarAccessibilityLabel: `Aba ${tabs[route.name].label}`,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: tab.label,
        tabBarStyle: tab.bar,
        tabBarItemStyle: tab.item,
        tabBarIcon: ({ color, focused }) =>
          renderTabIcon(tabs[route.name].icon, color, focused),
      })}
    >
      {(Object.keys(tabs) as (keyof PatientTabParamList)[]).map(name => (
        <Tab.Screen key={name} name={name} component={tabs[name].component} />
      ))}
    </Tab.Navigator>
  );
}

function renderTabIcon(name: IconName, color: string, focused: boolean) {
  return (
    <View style={[tab.icon, focused && tab.activeIcon]}>
      <Icon name={name} size={22} color={color} />
    </View>
  );
}

const tab = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  item: { minHeight: 56 },
  label: { fontFamily: fonts.bold, fontSize: 13, marginTop: 2 },
  icon: {
    width: 56,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIcon: { backgroundColor: colors.surfaceMuted },
});
