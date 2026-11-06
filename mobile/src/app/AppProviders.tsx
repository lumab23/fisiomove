import { AuthProvider } from '../auth/AuthContext';
import { ScreenMessageProvider } from '../components/ScreenMessage';
import { RootNavigator } from '../navigation/RootNavigator';
import { SessionSyncProvider } from '../sync/SessionSyncContext';

export function AppProviders() {
  return (
    <AuthProvider>
      <SessionSyncProvider>
        <ScreenMessageProvider>
          <RootNavigator />
        </ScreenMessageProvider>
      </SessionSyncProvider>
    </AuthProvider>
  );
}
