import { container } from 'tsyringe';
import { TypeORMSalonRepository } from '../repositories/TypeORMSalonRepository';

export function registerSalonDependencies(): void {
  container.register('ISalonRepository', { useClass: TypeORMSalonRepository });
}
