import type { ApiClient } from '../src/api/ApiClient';
import { ExerciseLibraryService } from '../src/services/exerciseLibrary';

function fakeApi() {
  return {
    get: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
  } as unknown as ApiClient & { get: jest.Mock; post: jest.Mock };
}

test('search sends only the filters that were filled in', async () => {
  const api = fakeApi();
  const service = new ExerciseLibraryService(api);

  await service.search({ query: '  ', body_part: '', page: 1, page_size: 20 });
  expect(api.get).toHaveBeenLastCalledWith(
    '/exercise-library?page=1&page_size=20',
  );
  await service.search({ query: ' arm raise ', body_part: 'upper_back' });
  expect(api.get).toHaveBeenLastCalledWith(
    '/exercise-library?query=arm%20raise&body_part=upper_back',
  );
});

test('details encode the external id in the path', async () => {
  const api = fakeApi();
  await new ExerciseLibraryService(api).get('EX-a b');
  expect(api.get).toHaveBeenCalledWith('/exercise-library/EX-a%20b');
});

test('adding to the catalog sends only the chosen sides', async () => {
  const api = fakeApi();
  await new ExerciseLibraryService(api).addToCatalog('EX-a b', [
    'left',
    'right',
  ]);
  expect(api.post).toHaveBeenCalledWith('/exercise-library/EX-a%20b/catalog', {
    allowed_sides: ['left', 'right'],
  });
  expect(api.get).not.toHaveBeenCalled();
});
