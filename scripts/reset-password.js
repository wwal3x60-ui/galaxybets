const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const readline = require('readline');

const databaseConfig = {
    host: 'mysql-3dd690bd-galaxybets.h.aivencloud.com',
    port: 11840,
    user: 'avnadmin',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false }
};

function promptHidden(prompt) {
    const input = process.stdin;
    const output = process.stdout;

    if (!input.isTTY || typeof input.setRawMode !== 'function') {
        const rl = readline.createInterface({ input, output });
        return new Promise((resolve, reject) => {
            rl.question(prompt, answer => {
                rl.close();
                resolve(answer);
            });
            rl.once('SIGINT', () => {
                rl.close();
                reject(new Error('Input cancelled'));
            });
        });
    }

    readline.emitKeypressEvents(input);

    return new Promise((resolve, reject) => {
        let answer = '';

        const cleanup = () => {
            input.removeListener('keypress', onKeypress);
            input.setRawMode(false);
            output.write('\n');
        };

        const onKeypress = (character, key = {}) => {
            if (key.ctrl && key.name === 'c') {
                cleanup();
                reject(new Error('Input cancelled'));
                return;
            }

            if (key.name === 'return' || key.name === 'enter') {
                cleanup();
                resolve(answer);
                return;
            }

            if (key.name === 'backspace') {
                answer = answer.slice(0, -1);
                return;
            }

            if (character && !key.ctrl && !key.meta) {
                answer += character;
            }
        };

        output.write(prompt);
        input.setRawMode(true);
        input.resume();
        input.on('keypress', onKeypress);
    });
}

function promptEmail(rl, prompt) {
    return new Promise((resolve, reject) => {
        rl.question(prompt, resolve);
        rl.once('SIGINT', () => reject(new Error('Input cancelled')));
    });
}

async function main() {
    let rl;
    let connection;

    try {
        const databasePassword = await promptHidden('Enter Aiven Database Password: ');
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const email = await promptEmail(rl, 'Enter the Email of the account to reset: ');
        rl.close();
        rl = undefined;
        const newPassword = await promptHidden('Enter the NEW password for this account: ');

        connection = await mysql.createConnection({
            ...databaseConfig,
            password: databasePassword
        });

        const passwordHash = await bcrypt.hash(newPassword, 12);
        const [result] = await connection.execute(
            'UPDATE users SET passwordHash = ? WHERE email = ?',
            [passwordHash, email]
        );

        if (result.affectedRows === 0) {
            console.log('❌ User not found.');
            return;
        }

        console.log('✅ Password updated successfully!');
    } finally {
        if (rl) {
            rl.close();
        }
        if (connection) {
            await connection.end();
        }
    }
}

main().catch(error => {
    if (error.message !== 'Input cancelled') {
        console.error('❌ Password update failed.');
        console.error(error.code || error.name || 'Unknown error');
    }
    process.exitCode = 1;
});
