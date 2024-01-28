export function createReadOnlyProvider(connection) {
    if (connection === undefined) {
        return undefined;
    }
    return { connection };
}
//# sourceMappingURL=connection.js.map