import * as Keychain from 'react-native-keychain';

export interface SecureJsonStorage {
  get<T>(service: string): Promise<T | null>;
  set<T>(service: string, value: T): Promise<void>;
  remove(service: string): Promise<void>;
}

export const keychainJsonStorage: SecureJsonStorage = {
  async get<T>(service: string): Promise<T | null> {
    const credentials = await Keychain.getGenericPassword({ service });
    if (!credentials) {
      return null;
    }
    try {
      return JSON.parse(credentials.password) as T;
    } catch {
      await Keychain.resetGenericPassword({ service });
      return null;
    }
  },

  async set<T>(service: string, value: T): Promise<void> {
    const result = await Keychain.setGenericPassword(
      'fisiomove',
      JSON.stringify(value),
      {
        service,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      },
    );
    if (!result) {
      throw new Error('Não foi possível proteger os dados locais.');
    }
  },

  async remove(service: string): Promise<void> {
    await Keychain.resetGenericPassword({ service });
  },
};
