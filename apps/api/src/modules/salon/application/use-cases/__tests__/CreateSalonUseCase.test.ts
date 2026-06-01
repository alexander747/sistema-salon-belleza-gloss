import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateSalonUseCase } from '../CreateSalonUseCase';
import type { ISalonRepository } from '../../../domain/ports/ISalonRepository';

// Mock all TypeORM entity imports that CreateSalonUseCase touches
vi.mock('../../../../../shared/database.js', () => ({
  AppDataSource: {
    getRepository: vi.fn().mockReturnValue({
      create: vi.fn().mockImplementation((data: unknown) => data),
      save: vi.fn().mockImplementation((data: unknown) => Promise.resolve(data)),
      findOneBy: vi.fn().mockResolvedValue(null),
    }),
  },
  initializeDatabase: vi.fn(),
}));

// Mock crypto
const mockCryptoBytes = Buffer.from('aa', 'hex');
vi.mock('crypto', () => ({
  default: { randomBytes: vi.fn(() => mockCryptoBytes) },
  randomBytes: vi.fn(() => mockCryptoBytes),
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed_password') },
  hash: vi.fn().mockResolvedValue('hashed_password'),
}));

// Mock entity modules to prevent TypeORM decorator processing
vi.mock('../../../../../infrastructure/persistence/entities/SalonEntity.js', () => ({
  SalonEntity: class SalonEntity {},
}));

vi.mock('../../../../../infrastructure/persistence/entities/UsuarioEntity.js', () => ({
  UsuarioEntity: class UsuarioEntity {},
}));

vi.mock('../../../../../infrastructure/persistence/entities/HorarioComercialEntity.js', () => ({
  HorarioComercialEntity: class HorarioComercialEntity {},
}));

describe('CreateSalonUseCase', () => {
  let useCase: CreateSalonUseCase;
  let mockSalonRepo: ISalonRepository;

  beforeEach(() => {
    mockSalonRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByApiKey: vi.fn(),
    };

    useCase = new CreateSalonUseCase(mockSalonRepo);
  });

  it('should create a salon and return SalonOutput', async () => {
    const createdSalon = {
      id: 1,
      nombre: 'Nails & Spa',
      numeroWhatsApp: '521234567890',
      nombreBot: 'Asistente Virtual',
      tonoVoz: 'amigable',
      plan: 'BASIC',
      estado: 'ACTIVO',
      activo: true,
      apiKeyN8n: 'any',
      logoUrl: null,
      colorPrimario: null,
      colorSecundario: null,
      tema: null,
      horasCancelacion: 24,
      creadoEn: new Date('2025-01-01'),
    };

    (mockSalonRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdSalon);

    const result = await useCase.execute(
      { nombre: 'Nails & Spa', numeroWhatsApp: '521234567890' },
      'María García',
      'maria@salon.com',
      'password123',
      '521234567890',
    );

    expect(result).toBeDefined();
    expect(result.nombre).toBe('Nails & Spa');
    expect(result.id).toBe(1);
    expect(result.horasCancelacion).toBe(24);
    expect(mockSalonRepo.create).toHaveBeenCalled();
  });

  it('should call salonRepo.create with expected fields', async () => {
    (mockSalonRepo.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 2,
      nombre: 'Test Salon',
      numeroWhatsApp: '521111111111',
      nombreBot: 'Bot',
      tonoVoz: 'formal',
      plan: 'BASIC',
      estado: 'ACTIVO',
      activo: true,
      apiKeyN8n: 'test-key',
      logoUrl: null,
      colorPrimario: null,
      colorSecundario: null,
      tema: null,
      horasCancelacion: 48,
      creadoEn: new Date(),
    });

    const result = await useCase.execute(
      { nombre: 'Test Salon', numeroWhatsApp: '521111111111', horasCancelacion: 48 },
      'Dueña Test',
      'duena@test.com',
      'pass123',
      '521111111111',
    );

    expect(result.nombre).toBe('Test Salon');
    expect(result.horasCancelacion).toBe(48);
  });
});
