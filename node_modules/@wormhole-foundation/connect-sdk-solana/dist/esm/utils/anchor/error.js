// Borrowed from coral-xyz/anchor
//
// https://github.com/coral-xyz/anchor/blob/master/ts/packages/anchor/src/error.ts
export class IdlError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IdlError';
    }
}
//# sourceMappingURL=error.js.map