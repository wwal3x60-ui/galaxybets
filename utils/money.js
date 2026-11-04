function parseDecimal(value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        throw new TypeError('Amount must be a number or numeric string');
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new TypeError('Amount must be finite');
    }

    const text = String(value).trim();
    const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
    if (!match || (!match[2] && !match[3])) {
        throw new TypeError('Amount must be a finite numeric value');
    }

    const sign = match[1] === '-' ? -1n : 1n;
    const integer = match[2] || '';
    const fraction = match[3] || '';
    const exponent = Number(match[4] || 0);
    if (!Number.isSafeInteger(exponent)) {
        throw new RangeError('Amount exponent is out of range');
    }

    let digitsText = `${integer}${fraction}`.replace(/^0+/, '') || '0';
    let scale = fraction.length - exponent;
    if (!Number.isSafeInteger(scale)) {
        throw new RangeError('Amount scale is out of range');
    }

    while (scale > 0 && digitsText.endsWith('0')) {
        digitsText = digitsText.slice(0, -1);
        scale -= 1;
    }

    return { sign, digits: BigInt(digitsText), digitLength: digitsText.length, scale };
}

function toCents(value) {
    const { sign, digits, digitLength, scale } = parseDecimal(value);
    let cents;

    if (scale <= 2) {
        const centsScale = 2 - scale;
        if (digits === 0n) {
            cents = 0n;
        } else if (digitLength + centsScale > 16) {
            throw new RangeError('Amount is too large to represent in integer cents');
        } else {
            cents = digits * (10n ** BigInt(centsScale));
        }
    } else {
        const divisorScale = scale - 2;
        if (divisorScale > digitLength) {
            cents = 0n;
        } else {
            const divisor = 10n ** BigInt(divisorScale);
            const quotient = digits / divisor;
            const remainder = digits % divisor;
            cents = quotient + (remainder * 2n >= divisor ? 1n : 0n);
        }
    }

    const signedCents = sign * cents;
    if (signedCents > BigInt(Number.MAX_SAFE_INTEGER) || signedCents < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new RangeError('Amount is too large to represent in integer cents');
    }

    return Number(signedCents);
}

function fromCents(cents) {
    if (!Number.isSafeInteger(cents)) {
        throw new TypeError('Cents must be a safe integer');
    }

    return cents / 100;
}

function roundUsd(value) {
    return fromCents(toCents(value));
}

function floorUsd(value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        throw new TypeError('Amount must be a number or numeric string');
    }

    if (typeof value === 'string' && value.trim() === '') {
        throw new TypeError('Amount must be a finite numeric value');
    }

    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new TypeError('Amount must be finite');
    }

    return Math.floor(Number((number * 100).toPrecision(12))) / 100;
}

function formatUsd(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(roundUsd(value));
}

function assertValidAmount(value, { min, max } = {}) {
    const parsed = parseDecimal(value);
    if (parsed.digits === 0n || parsed.sign < 0n) {
        throw new RangeError('Amount must be greater than zero');
    }
    if (parsed.scale > 2) {
        throw new RangeError('Amount cannot have more than two decimal places');
    }

    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        throw new RangeError('Amount must be finite');
    }
    if (min != null && amount < min) {
        throw new RangeError(`Amount must be at least ${min}`);
    }
    if (max != null && amount > max) {
        throw new RangeError(`Amount must be at most ${max}`);
    }

    return amount;
}

module.exports = {
    toCents,
    fromCents,
    roundUsd,
    floorUsd,
    formatUsd,
    assertValidAmount
};
