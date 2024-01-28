"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountData = exports.newReadOnlyAccountMeta = exports.newAccountMeta = exports.deriveAddress = void 0;
const web3_js_1 = require("@solana/web3.js");
/**
 * Find valid program address. See {@link PublicKey.findProgramAddressSync} for details.
 *
 * @param {(Buffer | Uint8Array)[]} seeds - seeds for PDA
 * @param {PublicKeyInitData} programId - program address
 * @returns PDA
 */
function deriveAddress(seeds, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync(seeds, new web3_js_1.PublicKey(programId))[0];
}
exports.deriveAddress = deriveAddress;
/**
 * Factory to create AccountMeta with `isWritable` set to `true`
 *
 * @param {PublicKEyInitData} pubkey - account address
 * @param {boolean} isSigner - whether account authorized transaction
 * @returns metadata for writable account
 */
function newAccountMeta(pubkey, isSigner) {
    return {
        pubkey: new web3_js_1.PublicKey(pubkey),
        isWritable: true,
        isSigner,
    };
}
exports.newAccountMeta = newAccountMeta;
/**
 * Factory to create AccountMeta with `isWritable` set to `false`
 *
 * @param {PublicKEyInitData} pubkey - account address
 * @param {boolean} isSigner - whether account authorized transaction
 * @returns metadata for read-only account
 */
function newReadOnlyAccountMeta(pubkey, isSigner) {
    return {
        pubkey: new web3_js_1.PublicKey(pubkey),
        isWritable: false,
        isSigner,
    };
}
exports.newReadOnlyAccountMeta = newReadOnlyAccountMeta;
/**
 * Get serialized data from account
 *
 * @param {AccountInfo<Buffer>} info - Solana AccountInfo
 * @returns serialized data as Buffer
 */
function getAccountData(info) {
    if (info === null) {
        throw Error('account info is null');
    }
    return info.data;
}
exports.getAccountData = getAccountData;
//# sourceMappingURL=account.js.map