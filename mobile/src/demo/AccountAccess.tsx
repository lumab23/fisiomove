import { createContext, useContext } from 'react';
export const AccountContext = createContext<{
  action?: () => void;
  label: string;
  email?: string;
  professionalDemo: boolean;
}>({ label: 'Acessar minha conta', professionalDemo: true });
export function useAccount() {
  return useContext(AccountContext);
}
