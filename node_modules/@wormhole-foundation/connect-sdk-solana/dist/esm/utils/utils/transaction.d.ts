import { Transaction, Keypair, Connection, PublicKeyInitData, PublicKey, ConfirmOptions, RpcResponseAndContext, SignatureResult, TransactionSignature, Signer } from '@solana/web3.js';
/**
 * Object that holds list of unsigned {@link Transaction}s and {@link Keypair}s
 * required to sign for each transaction.
 */
export interface PreparedTransactions {
    unsignedTransactions: Transaction[];
    signers: Signer[];
}
export interface TransactionSignatureAndResponse {
    signature: TransactionSignature;
    response: RpcResponseAndContext<SignatureResult>;
}
/**
 * Resembles WalletContextState and Anchor's NodeWallet's signTransaction function signature
 */
export type SignTransaction = (transaction: Transaction) => Promise<Transaction>;
/**
 *
 * @param payers
 * @returns
 */
export declare function signTransactionFactory(...payers: Signer[]): SignTransaction;
export declare function modifySignTransaction(signTransaction: SignTransaction, ...payers: Signer[]): SignTransaction;
/**
 * Wrapper for {@link Keypair} resembling Solana web3 browser wallet
 */
export declare class NodeWallet {
    payer: Keypair;
    signTransaction: SignTransaction;
    constructor(payer: Keypair);
    static fromSecretKey(secretKey: Uint8Array, options?: {
        skipValidation?: boolean | undefined;
    } | undefined): NodeWallet;
    publicKey(): PublicKey;
    pubkey(): PublicKey;
    key(): PublicKey;
    toString(): string;
    keypair(): Keypair;
    signer(): Signer;
}
/**
 * The transactions provided to this function should be ready to send.
 * This function will do the following:
 * 1. Add the {@param payer} as the feePayer and latest blockhash to the {@link Transaction}.
 * 2. Sign using {@param signTransaction}.
 * 3. Send raw transaction.
 * 4. Confirm transaction.
 */
export declare function signSendAndConfirmTransaction(connection: Connection, payer: PublicKeyInitData, signTransaction: SignTransaction, unsignedTransaction: Transaction, options?: ConfirmOptions): Promise<TransactionSignatureAndResponse>;
/**
 * @deprecated Please use {@link signSendAndConfirmTransaction} instead, which allows
 * retries to be configured in {@link ConfirmOptions}.
 *
 * The transactions provided to this function should be ready to send.
 * This function will do the following:
 * 1. Add the {@param payer} as the feePayer and latest blockhash to the {@link Transaction}.
 * 2. Sign using {@param signTransaction}.
 * 3. Send raw transaction.
 * 4. Confirm transaction.
 */
export declare function sendAndConfirmTransactionsWithRetry(connection: Connection, signTransaction: SignTransaction, payer: string, unsignedTransactions: Transaction[], maxRetries?: number, options?: ConfirmOptions): Promise<TransactionSignatureAndResponse[]>;
//# sourceMappingURL=transaction.d.ts.map