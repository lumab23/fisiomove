import { createContext, useContext } from 'react';
import { Link } from '../ui';
export const AccountContext = createContext<{
  action?: () => void;
  label: string;
}>({ label: 'Acessar minha conta' });
export function AccountAccess() {
  const { action, label } = useContext(AccountContext);
  return action ? <Link label={label} onPress={action} /> : null;
}
