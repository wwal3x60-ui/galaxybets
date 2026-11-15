const mysql = require('mysql2/promise');

const connection = {
    host: process.env.SQL_HOST || 'localhost',
    port: Number(process.env.SQL_PORT || 3306),
    user: process.env.SQL_USER,
    database: process.env.SQL_DB,
    password: process.env.SQL_PASS,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
    ssl: (process.env.NODE_ENV === 'development' && ['127.0.0.1','localhost','::1'].includes(process.env.SQL_HOST || 'localhost')) ? undefined : process.env.SQL_CA
        ? { ca: process.env.SQL_CA, rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    typeCast: function (field, next) {
        if (field.type == "NEWDECIMAL") {
            const value = field.string();
            return (value === null) ? null : Number(value);
        }
        return next();
    }
};

const pool = mysql.createPool(connection);
pool.on('error', (error) => {
    console.error('Database pool error:', error.code || 'UNKNOWN');
});

async function doTransaction(transactionLogic) {
    const connection = await pool.getConnection();
    let hasEnded = false;
    let broken = false;
    async function commit() {
        if (hasEnded) throw new Error('Transaction has already been committed or rolled back.');
        try {
            const [result] = await connection.commit();
            // COMMIT has completed: never replay or attempt to undo an uncertain result.
            hasEnded = true;
            if (result && result.warningStatus) throw new Error('Commit err: ' + result.warningStatus);
        } catch (error) { broken = true; throw error; }
    }
    async function rollback() {
        if (hasEnded) throw new Error('Transaction has already been committed or rolled back.');
        try {
            await connection.rollback();
            hasEnded = true;
        } catch (error) { broken = true; throw error; }
    }
    try {
        const [result] = await connection.beginTransaction();
        if (result && result.warningStatus) throw new Error('Transaction err: ' + result.warningStatus);
        const value = await transactionLogic(connection, commit, rollback);
        if (!hasEnded) await rollback();
        return value;
    } catch (error) {
        if (error.fatal || ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'HANDSHAKE_SSL_ERROR'].includes(error.code)) broken = true;
        if (!hasEnded && !broken) {
            try { await rollback(); }
            catch (cleanupError) { console.error('Transaction rollback failed:', cleanupError.code || cleanupError.message); }
        }
        throw error;
    } finally {
        if (broken) connection.destroy();
        else connection.release();
    }
}

module.exports = {
    sql: pool,
    doTransaction
};