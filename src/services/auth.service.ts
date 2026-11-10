import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseApp } from '../config/firebase';
import { ApiError, infrastructureError } from './api-error';

export interface VerifiedIdentity { readonly uid: string; readonly email?: string; readonly provider: string }
export type TokenVerifier = (token: string, checkRevoked: boolean) => Promise<DecodedIdToken>;

export function createAuthService(verify: TokenVerifier = (token, revoked) => getAuth(getFirebaseApp()).verifyIdToken(token, revoked)) {
  return async (token: string): Promise<VerifiedIdentity> => {
    let decoded: DecodedIdToken;
    try { decoded = await verify(token, true); }
    catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (typeof code === 'string' && [
        'auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token', 'auth/id-token-expired',
        'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found',
      ].includes(code)) throw new ApiError(401, 'Token inválido, expirado o revocado');
      infrastructureError(error);
    }
    if (!decoded.uid || decoded.uid.includes('/')) throw new ApiError(401, 'Identidad inválida');
    const provider = decoded.firebase?.sign_in_provider;
    if (provider !== 'password' && provider !== 'google.com') throw new ApiError(403, 'Proveedor no permitido');
    return Object.freeze({ uid: decoded.uid, email: decoded.email, provider });
  };
}
