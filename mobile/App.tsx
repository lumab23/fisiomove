import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProviders } from './src/app/AppProviders';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppProviders />
    </SafeAreaProvider>
  );
}

export default App;
