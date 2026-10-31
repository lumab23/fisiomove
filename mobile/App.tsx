import { useState } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProviders } from './src/app/AppProviders';
import { DemoProvider } from './src/demo/DemoContext';
import { FrontendNavigator } from './src/navigation/FrontendNavigator';
import { Link, styles } from './src/ui';

function App() {
  const [accountMode, setAccountMode] = useState(false);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {accountMode ? (
        <View style={styles.safe}>
          <Link
            label="‹  Voltar à demonstração"
            onPress={() => setAccountMode(false)}
          />
          <AppProviders />
        </View>
      ) : (
        <DemoProvider>
          <FrontendNavigator onAccount={() => setAccountMode(true)} />
        </DemoProvider>
      )}
    </SafeAreaProvider>
  );
}
export default App;
