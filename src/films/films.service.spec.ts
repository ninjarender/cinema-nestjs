import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { FilmsService } from './films.service.js';

describe('FilmsService', () => {
  let service: FilmsService;
  const showingsCore = { hasShowingsForFilm: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        FilmsService,
        { provide: ShowingsCoreService, useValue: showingsCore },
      ],
    }).compile();

    service = moduleRef.get(FilmsService);
  });

  it('видаляє фільм без сеансів', () => {
    showingsCore.hasShowingsForFilm.mockReturnValue(false);
    const film = service.create({
      title: 'Земля',
      durationMinutes: 75,
      releaseYear: 1930,
    });

    service.remove(film.id);

    expect(showingsCore.hasShowingsForFilm).toHaveBeenCalledWith(film.id);
    expect(() => service.findOne(film.id)).toThrow(NotFoundException);
  });

  it('повертає 409, якщо на фільм посилається сеанс', () => {
    showingsCore.hasShowingsForFilm.mockReturnValue(true);
    const film = service.create({
      title: 'Земля',
      durationMinutes: 75,
      releaseYear: 1930,
    });

    expect(() => service.remove(film.id)).toThrow(ConflictException);
    expect(service.findOne(film.id)).toEqual(film);
  });

  it('не перевіряє сеанси, якщо фільму немає', () => {
    expect(() => service.remove('missing')).toThrow(NotFoundException);
    expect(showingsCore.hasShowingsForFilm).not.toHaveBeenCalled();
  });
});
