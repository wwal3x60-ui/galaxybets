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
    ssl: process.env.SQL_CA
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

    async function commit() {
        if (hasEnded) throw new Error('Transaction has already been committed or rolled back.');
        const [commitResult] = await connection.commit();
        if (commitResult && commitResult.warningStatus) {
            throw new Error('Commit err: ' + commitResult.warningStatus);
        }
        hasEnded = true;
    }

    async function rollback() {
        if (hasEnded) throw new Error('Transaction has already been committed or rolled back.');
        const [rollbackResult] = await connection.rollback();
        if (rollbackResult && rollbackResult.warningStatus) {
            throw new Error('Rollback err: ' + rollbackResult.warningStatus);
        }
        hasEnded = true;
    }

    try {
        const [txResult] = await connection.beginTransaction();
        if (txResult && txResult.warningStatus) {
            throw new Error('Transaction err: ' + txResult.warningStatus);
        }

        const res = await transactionLogic(connection, commit, rollback);

        if (!hasEnded) await rollback();
        return res;
        
    } catch (err) {
        if (!hasEnded) await rollback();
        throw err;
    } finally {
        connection.release();
    }
}

module.exports = {
    sql: pool,
    doTransaction
};