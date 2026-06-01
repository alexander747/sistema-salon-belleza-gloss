import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { SalonSuperadminController } from '../SalonSuperadminController';

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

// Mock database
vi.mock('../../../../../shared/database.js', () => ({
  AppDataSource: {
    getRepository: vi.fn().mockReturnValue({
      create: vi.fn(),
      save: vi.fn().mockResolvedValue([]),
      findOneBy: vi.fn().mockResolvedValue(null),
    }),
  },
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: { hash: vi.fn().mockResolvedValue('hash') },
  hash: vi.fn().mockResolvedValue('hash'),
}));

// Mock crypto
vi.mock('crypto', () => ({
  default: { randomBytes: vi.fn(() => Buffer.from('aa', 'hex')) },
  randomBytes: vi.fn(() => Buffer.from('aa', 'hex')),
}));

describe('SalonSuperadminController', () => {
  let controller: SalonSuperadminController;
  let mockCreateSalonUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockListSalonesUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCreateSalonUseCase = { execute: vi.fn() };
    mockListSalonesUseCase = { execute: vi.fn() };
    controller = new SalonSuperadminController(
      mockCreateSalonUseCase as never,
      { execute: vi.fn() } as never,
      mockListSalonesUseCase as never,
      { execute: vi.fn() } as never,
      { execute: vi.fn() } as never,
    );
  });

  describe('create', () => {
    it('should return 201 when salon is created', async () => {
      const expectedSalon = {
        id: 1,
        nombre: 'Nuevo Salon',
        numeroWhatsApp: '521234567890',
        nombreBot: 'Asistente Virtual',
        tonoVoz: 'amigable',
        plan: 'BASIC',
        estado: 'ACTIVO',
        activo: true,
        apiKeyN8n: 'apikey123',
        logoUrl: null,
        colorPrimario: null,
        colorSecundario: null,
        tema: null,
        horasCancelacion: 24,
        creadoEn: new Date(),
      };

      mockCreateSalonUseCase.execute.mockResolvedValue(expectedSalon);

      const req = {
        body: {
          nombre: 'Nuevo Salon',
          numeroWhatsApp: '521234567890',
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expectedSalon);
      expect(mockCreateSalonUseCase.execute).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return 200 with list of salones', async () => {
      const salones = [
        {
          id: 1,
          nombre: 'Salon A',
          numeroWhatsApp: '521111111111',
          nombreBot: 'Bot A',
          tonoVoz: 'amigable',
          plan: 'BASIC',
          estado: 'ACTIVO',
          activo: true,
          apiKeyN8n: 'keyA',
          logoUrl: null,
          colorPrimario: null,
          colorSecundario: null,
          tema: null,
          horasCancelacion: 24,
          creadoEn: new Date(),
        },
        {
          id: 2,
          nombre: 'Salon B',
          numeroWhatsApp: '522222222222',
          nombreBot: 'Bot B',
          tonoVoz: 'formal',
          plan: 'PREMIUM',
          estado: 'ACTIVO',
          activo: true,
          apiKeyN8n: 'keyB',
          logoUrl: null,
          colorPrimario: null,
          colorSecundario: null,
          tema: null,
          horasCancelacion: 48,
          creadoEn: new Date(),
        },
      ];

      mockListSalonesUseCase.execute.mockResolvedValue(salones);

      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.list(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(salones);
    });

    it('should return empty array when no salones exist', async () => {
      mockListSalonesUseCase.execute.mockResolvedValue([]);

      const req = {} as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await controller.list(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });
});
