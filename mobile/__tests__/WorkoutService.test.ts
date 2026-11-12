import type { ApiClient } from '../src/api/ApiClient';
import { WorkoutService } from '../src/services/workouts';

test('representa corretamente a ausência de treinos publicados', async () => {
  const empty = { items: [], page: 1, page_size: 20, total: 0, pages: 0 };
  const api = {
    get: jest.fn().mockResolvedValue(empty),
  } as unknown as ApiClient;

  await expect(new WorkoutService(api).listMine()).resolves.toEqual(empty);
  expect(api.get).toHaveBeenCalledWith('/me/workouts');
});

test('consulta o detalhe usando o identificador recebido da API', async () => {
  const api = {
    get: jest.fn().mockResolvedValue({ id: 'workout' }),
  } as unknown as ApiClient;
  const workoutId = '44444444-4444-4444-8444-444444444444';

  await new WorkoutService(api).get(workoutId);
  expect(api.get).toHaveBeenCalledWith(`/workouts/${workoutId}`);
});
