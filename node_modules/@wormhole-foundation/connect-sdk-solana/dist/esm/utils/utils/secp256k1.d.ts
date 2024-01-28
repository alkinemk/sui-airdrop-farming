/// <reference types="node" />
import { TransactionInstruction } from '@solana/web3.js';
export declare const SIGNATURE_LENGTH = 65;
export declare const ETHEREUM_KEY_LENGTH = 20;
/**
 * Create {@link TransactionInstruction} for {@link Secp256k1Program}.
 *
 * @param {Buffer[]} signatures - 65-byte signatures (64 bytes + 1 byte recovery id)
 * @param {Buffer[]} keys - 20-byte ethereum public keys
 * @param {Buffer} message - 32-byte hash
 * @returns Solana instruction for Secp256k1 program
 */
export declare function createSecp256k1Instruction(signatures: Buffer[], keys: Buffer[], message: Buffer): TransactionInstruction;
/**
 * Secp256k1SignatureOffsets serializer
 *
 * See {@link https://docs.solana.com/developing/runtime-facilities/programs#secp256k1-program} for more info.
 */
export declare class Secp256k1SignatureOffsets {
    /**
     * Serialize multiple signatures, ethereum public keys and message as Secp256k1 instruction data.
     *
     * @param {Buffer[]} signatures - 65-byte signatures (64 + 1 recovery id)
     * @param {Buffer[]} keys - ethereum public keys
     * @param {Buffer} message - 32-byte hash
     * @returns serialized Secp256k1 instruction data
     */
    static serialize(signatures: Buffer[], keys: Buffer[], message: Buffer): Buffer;
}
//# sourceMappingURL=secp256k1.d.ts.map