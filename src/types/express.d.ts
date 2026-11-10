import type { VerifiedIdentity } from '../services/auth.service';
declare global {
  namespace Express {
    interface Request { identity?: VerifiedIdentity }
  }
}
export {};
