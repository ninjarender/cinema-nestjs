import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { Film } from './entities/film.entity.js';
import { FilmsService } from './films.service.js';

const film: Film = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  title: 'Земля',
  durationMinutes: 75,
  releaseYear: 1930,
};

describe('FilmsService', () => {
  let service: FilmsService;
  const showingsCore = { hasShowingsForFilm: vi.fn() };
  const filmsRepository = {
    findOneBy: vi.fn(),
    preload: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    filmsRepository.findOneBy.mockResolvedValue(film);

    const moduleRef = await Test.createTestingModule({
      providers: [
        FilmsService,
        { provide: getRepositoryToken(Film), useValue: filmsRepository },
        { provide: ShowingsCoreService, useValue: showingsCore },
      ],
    }).compile();

    service = moduleRef.get(FilmsService);
  });

  it('видаляє фільм без сеансів', async () => {
    showingsCore.hasShowingsForFilm.mockResolvedValue(false);

    await service.remove(film.id);

    expect(showingsCore.hasShowingsForFilm).toHaveBeenCalledWith(film.id);
    expect(filmsRepository.remove).toHaveBeenCalledWith(film);
  });

  it('повертає 409 і не видаляє, якщо на фільм посилається сеанс', async () => {
    showingsCore.hasShowingsForFilm.mockResolvedValue(true);

    await expect(service.remove(film.id)).rejects.toThrow(ConflictException);
    expect(filmsRepository.remove).not.toHaveBeenCalled();
  });

  it('не перевіряє сеанси, якщо фільму немає', async () => {
    filmsRepository.findOneBy.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    expect(showingsCore.hasShowingsForFilm).not.toHaveBeenCalled();
  });

  it('повертає 404 на оновлення неіснуючого фільму', async () => {
    filmsRepository.preload.mockResolvedValue(undefined);

    await expect(service.update('missing', { title: 'Нема' })).rejects.toThrow(
      NotFoundException,
    );
    expect(filmsRepository.save).not.toHaveBeenCalled();
  });
});
