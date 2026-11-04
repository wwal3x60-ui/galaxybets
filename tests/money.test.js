const test = require('node:test');
const assert = require('node:assert/strict');

const {
    toCents,
    fromCents,
    roundUsd,
    floorUsd,
    formatUsd,
    assertValidAmount
} = require('../utils/money');

test('converts floating-point sums to cents without float drift', () => {
    assert.equal(toCents(0.1 + 0.2), 30);
});

test('rounds decimal ties half up from numbers and strings', () => {
    assert.equal(toCents(1.005), 101);
    assert.equal(toCents(0.015), 2);
    assert.equal(roundUsd('1.005'), 1.01);
});

test('floors USD values to cents without float noise', () => {
    assert.equal(floorUsd(1.999), 1.99);
    assert.equal(floorUsd(1.15), 1.15);
    assert.equal(floorUsd(0.29), 0.29);
    assert.equal(floorUsd(1.005), 1);
    assert.equal(floorUsd('12.349'), 12.34);
    assert.equal(floorUsd(-0.001), -0.01);
});

test('rejects invalid floorUsd inputs', () => {
    for (const value of [NaN, Infinity, -Infinity, 'NaN', 'Infinity', '', 'not money', null, undefined]) {
        assert.throws(() => floorUsd(value));
    }
});

test('converts amounts around common multiplication boundaries', () => {
    assert.equal(toCents(19.99), 1999);
    assert.equal(toCents(19.99 * 100), 199900);
});

test('supports large values and preserves numeric string cents', () => {
    assert.equal(toCents('12345678901234.56'), 1234567890123456);
    assert.equal(toCents('12.30'), 1230);
    assert.equal(fromCents(1230), 12.3);
});

test('formats rounded USD values with grouping and two decimal places', () => {
    assert.equal(formatUsd('1234.5'), '$1,234.50');
    assert.equal(formatUsd(1.005), '$1.01');
});

test('rejects invalid and out-of-range amounts', () => {
    for (const value of [NaN, Infinity, -Infinity, 'NaN', 'Infinity', 'not money']) {
        assert.throws(() => toCents(value));
        assert.throws(() => assertValidAmount(value));
    }

    for (const value of [0, -1, '0', '-0.01']) {
        assert.throws(() => assertValidAmount(value));
    }

    assert.throws(() => assertValidAmount('1.001'));
    assert.throws(() => assertValidAmount(4.99, { min: 5 }));
    assert.throws(() => assertValidAmount(10.01, { max: 10 }));
    assert.equal(assertValidAmount('5.00', { min: 5, max: null }), 5);
});
