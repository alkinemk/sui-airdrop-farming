"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReadOnlyProvider = void 0;
function createReadOnlyProvider(connection) {
    if (connection === undefined) {
        return undefined;
    }
    return { connection };
}
exports.createReadOnlyProvider = createReadOnlyProvider;
//# sourceMappingURL=connection.js.map