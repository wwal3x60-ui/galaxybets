const _ = require("lodash");
const crypto = require("crypto");

const houseEdge = 1 / 100;
const totalTiles = 25;

function shuffle(array,floats, includeMatrix = false) {

    const copy = [];
    const breakdown = [];
    let n = array.length;

    while (n > 1) {
        if (includeMatrix) {
            breakdown.push([...copy, ...array]);
        }

        const i = Math.floor(floats[copy.length]);

        n--;

        copy.push(array.splice(i, 1)[0]);
    }

    return includeMatrix ? [copy, breakdown] : copy;
}

function* byteGenerator(serverSeed, clientSeed, nonce, cursor) {

    let currentRound = Math.floor(cursor / 32);
    let currentRoundCursor = cursor;
    currentRoundCursor -= currentRound * 32;

    while (true) {
        const hmac = crypto.createHmac("sha256", serverSeed);
        hmac.update(`${clientSeed}:${nonce}:${currentRound}`);
        const buffer = hmac.digest();

        while (currentRoundCursor < 32) {
            yield Number(buffer[currentRoundCursor]);
            currentRoundCursor += 1;
        }
        currentRoundCursor = 0;
        currentRound += 1;
    }

}

function generateFloats(serverSeed, clientSeed, nonce, cursor, count) {

    const numbers = byteGenerator(serverSeed, clientSeed, nonce, cursor);
    const bytes = [];

    while (bytes.length < count * 4) {
        bytes.push(numbers.next().value);
    }

    return _.chunk(bytes, 4).map((bytesChunk) =>
        bytesChunk.reduce((result, value, i) => {
            const divider = 256 ** (i + 1);
            const partialResult = value / divider;
            return result + partialResult;
        }, 0)
    );

}

function generateMinePositions(serverSeed, clientSeed, nonce, mines) {

    const floats = _.flatten(
        generateFloats(serverSeed, clientSeed, nonce, 0, mines)
    ).map((float, index) => float * (25 - index));

    const minePositions = shuffle(
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
        floats
    ).slice(0, mines);

    return minePositions;

}

function calculateMultiplier(mineCount, revealedTiles) {
    if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount >= totalTiles ||
        !Number.isInteger(revealedTiles) || revealedTiles < 0 || revealedTiles > totalTiles - mineCount) {
        throw new RangeError('Invalid Mines configuration');
    }
    if (revealedTiles === 0) return 1;

    // C(25,k) / C(25-mines,k), with a 1% house edge.
    // Exact integers avoid binary floating-point errors at half-cent boundaries.
    const combinations = (n, k) => {
        k = Math.min(k, n - k);
        let result = 1n;
        for (let i = 1; i <= k; i++) {
            result = result * BigInt(n - k + i) / BigInt(i);
        }
        return result;
    };
    const numerator = 99n * combinations(totalTiles, revealedTiles);
    const denominator = combinations(totalTiles - mineCount, revealedTiles);
    // Multiplier rounded half-up to two decimals, matching the supplied chart.
    const hundredths = (2n * numerator + denominator) / (2n * denominator);
    return Number(hundredths) / 100;
}

module.exports = {
    calculateMultiplier,
    generateMinePositions,
    totalTiles,
    houseEdge
}