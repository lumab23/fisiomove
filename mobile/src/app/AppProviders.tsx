import { AuthProvider } from '../auth/AuthContext';
import { RootNavigator } from '../navigation/RootNavigator';
import { SessionSyncProvider } from '../sync/SessionSyncContext';

export function AppProviders() {
  return (
    <AuthProvider>
      <SessionSyncProvider>
        <RootNavigator />
      </SessionSyncProvider>
    </AuthProvider>
  );
}
