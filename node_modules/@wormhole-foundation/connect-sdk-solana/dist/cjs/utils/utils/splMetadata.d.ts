/// <reference types="node" />
import { Commitment, Connection, PublicKey, PublicKeyInitData, TransactionInstruction } from '@solana/web3.js';
export declare class Creator {
    address: PublicKey;
    verified: boolean;
    share: number;
    constructor(address: PublicKeyInitData, verified: boolean, share: number);
    static size: number;
    serialize(): Buffer;
    static deserialize(data: Buffer): Creator;
}
export declare class Data {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Creator[] | null;
    constructor(name: string, symbol: string, uri: string, sellerFeeBasisPoints: number, creators: Creator[] | null);
    serialize(): Buffer;
    static deserialize(data: Buffer): Data;
}
export declare class CreateMetadataAccountArgs extends Data {
    isMutable: boolean;
    constructor(name: string, symbol: string, uri: string, sellerFeeBasisPoints: number, creators: Creator[] | null, isMutable: boolean);
    static serialize(name: string, symbol: string, uri: string, sellerFeeBasisPoints: number, creators: Creator[] | null, isMutable: boolean): Buffer;
    static serializeInstructionData(name: string, symbol: string, uri: string, sellerFeeBasisPoints: number, creators: Creator[] | null, isMutable: boolean): Buffer;
    serialize(): Buffer;
}
export declare class SplTokenMetadataProgram {
    /**
     * @internal
     */
    constructor();
    /**
     * Public key that identifies the SPL Token Metadata program
     */
    static programId: PublicKey;
    static createMetadataAccounts(payer: PublicKey, mint: PublicKey, mintAuthority: PublicKey, name: string, symbol: string, updateAuthority: PublicKey, updateAuthorityIsSigner?: boolean, uri?: string, creators?: Creator[] | null, sellerFeeBasisPoints?: number, isMutable?: boolean, metadataAccount?: PublicKey): TransactionInstruction;
}
export declare function deriveSplTokenMetadataKey(mint: PublicKeyInitData): PublicKey;
export declare enum Key {
    Uninitialized = 0,
    EditionV1 = 1,
    MasterEditionV1 = 2,
    ReservationListV1 = 3,
    MetadataV1 = 4,
    ReservationListV2 = 5,
    MasterEditionV2 = 6,
    EditionMarker = 7
}
export declare class Metadata {
    key: Key;
    updateAuthority: PublicKey;
    mint: PublicKey;
    data: Data;
    primarySaleHappened: boolean;
    isMutable: boolean;
    constructor(key: number, updateAuthority: PublicKeyInitData, mint: PublicKeyInitData, data: Data, primarySaleHappened: boolean, isMutable: boolean);
    static deserialize(data: Buffer): Metadata;
}
export declare function getMetadata(connection: Connection, mint: PublicKeyInitData, commitment?: Commitment): Promise<Metadata>;
//# sourceMappingURL=splMetadata.d.ts.map