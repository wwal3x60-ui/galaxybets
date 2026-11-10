'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
function patchedSource(source) {
    const begin = source.indexOf('function mapItem(e)');
    if (begin < 0) throw Error('Case item mapper not found; no source file was changed.');
    const body = source.slice(begin);
    if (/startTicket\s*:\s*Number\(e\.rangeFrom\)/.test(body) && /endTicket\s*:\s*Number\(e\.rangeTo\)/.test(body)) return source;
    const line = /^([ \t]*)probability:\s*\+getItemProbability\(e\.rangeFrom,\s*e\.rangeTo\)\.toFixed\(3\),?\r?$/gm;
    const matches = [...source.matchAll(line)];
    if (matches.length !== 1 || matches[0].index < begin) throw Error('Case mapper differs from expected; no source file was changed.');
    const nl = source.includes('\r\n') ? '\r\n' : '\n';
    return source.replace(line, (original, indent) => `${indent}startTicket: Number(e.rangeFrom),${nl}${indent}endTicket: Number(e.rangeTo),${nl}${original}`);
}
function ensureTicketFields(backendRoot, apply = false) {
    const file = path.join(backendRoot, 'routes/games/cases/functions.js');
    const source = fs.readFileSync(file, 'utf8');
    const next = patchedSource(source);
    if (next === source) return { ticketFields: 'already-present' };
    if (!apply) return { ticketFields: 'will-add' };
    const suffix = Date.now() + '-' + process.pid;
    const backup = file + '.before-ticket-fields-' + suffix;
    const temporary = file + '.ticket-fields-' + suffix + '.js';
    try {
        fs.writeFileSync(temporary, next);
        const check = spawnSync(process.execPath, ['--check', temporary], { encoding: 'utf8' });
        if (check.status !== 0) throw Error('Ticket field patch syntax check failed: ' + check.stderr);
        fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
        fs.renameSync(temporary, file);
        return { ticketFields: 'added', sourceBackup: backup };
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
}
module.exports = { patchedSource, ensureTicketFields };
