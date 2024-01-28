"use strict";
// Borrowed from coral-xyz/anchor
//
// https://github.com/coral-xyz/anchor/blob/master/ts/packages/anchor/src/error.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdlError = void 0;
class IdlError extends Error {
    constructor(message) {
        super(message);
        this.name = 'IdlError';
    }
}
exports.IdlError = IdlError;
//# sourceMappingURL=error.js.map