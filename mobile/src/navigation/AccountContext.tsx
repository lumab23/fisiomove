import { createContext, useContext } from 'react';

/** Authenticated account shown on the profile; provided by the navigator. */
export const AccountContext = createContext<{
  email?: string;
  signOut?: () => void;
}>({});

export function useAccount() {
  return useContext(AccountContext);
}
