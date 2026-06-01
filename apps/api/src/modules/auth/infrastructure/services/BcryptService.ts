import bcrypt from 'bcrypt';
import { injectable } from 'tsyringe';

const SALT_ROUNDS = 12;

export interface IBcryptService {
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
}

@injectable()
export class BcryptService implements IBcryptService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
