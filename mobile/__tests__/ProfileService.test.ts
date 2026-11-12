import type { ApiClient } from '../src/api/ApiClient';
import { ProfileService } from '../src/services/profile';

test('lê somente o próprio perfil em /me/profile', async () => {
  const api = {
    get: jest.fn().mockResolvedValue({ full_name: 'Joana Souza' }),
  } as unknown as ApiClient;

  await expect(new ProfileService(api).mine()).resolves.toEqual({
    full_name: 'Joana Souza',
  });
  expect(api.get).toHaveBeenCalledWith('/me/profile');
});

test('lê o fisioterapeuta vinculado e o próprio perfil profissional', async () => {
  const api = {
    get: jest.fn().mockResolvedValue({ full_name: null }),
    put: jest.fn().mockResolvedValue({ full_name: 'Dra. Teste' }),
  } as unknown as ApiClient;
  const service = new ProfileService(api);

  await service.linkedPhysiotherapist();
  expect(api.get).toHaveBeenLastCalledWith('/me/physiotherapist');
  await service.physiotherapistProfile();
  expect(api.get).toHaveBeenLastCalledWith('/me/physiotherapist-profile');
  await expect(
    service.updatePhysiotherapistProfile({ full_name: 'Dra. Teste' }),
  ).resolves.toEqual({ full_name: 'Dra. Teste' });
  expect(api.put).toHaveBeenCalledWith('/me/physiotherapist-profile', {
    full_name: 'Dra. Teste',
  });
});
