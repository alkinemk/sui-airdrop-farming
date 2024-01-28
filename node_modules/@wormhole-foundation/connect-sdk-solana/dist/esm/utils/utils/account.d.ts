/// <reference types="node" />
import { PublicKey, AccountMeta, AccountInfo, PublicKeyInitData } from '@solana/web3.js';
/**
 * Find valid program address. See {@link PublicKey.findProgramAddressSync} for details.
 *
 * @param {(Buffer | Uint8Array)[]} seeds - seeds for PDA
 * @param {PublicKeyInitData} programId - program address
 * @returns PDA
 */
export declare function deriveAddress(seeds: (Buffer | Uint8Array)[], programId: PublicKeyInitData): PublicKey;
/**
 * Factory to create AccountMeta with `isWritable` set to `true`
 *
 * @param {PublicKEyInitData} pubkey - account address
 * @param {boolean} isSigner - whether account authorized transaction
 * @returns metadata for writable account
 */
export declare function newAccountMeta(pubkey: PublicKeyInitData, isSigner: boolean): AccountMeta;
/**
 * Factory to create AccountMeta with `isWritable` set to `false`
 *
 * @param {PublicKEyInitData} pubkey - account address
 * @param {boolean} isSigner - whether account authorized transaction
 * @returns metadata for read-only account
 */
export declare function newReadOnlyAccountMeta(pubkey: PublicKeyInitData, isSigner: boolean): AccountMeta;
/**
 * Get serialized data from account
 *
 * @param {AccountInfo<Buffer>} info - Solana AccountInfo
 * @returns serialized data as Buffer
 */
export declare function getAccountData(info: AccountInfo<Buffer> | null): Buffer;
//# sourceMappingURL=account.d.ts.map