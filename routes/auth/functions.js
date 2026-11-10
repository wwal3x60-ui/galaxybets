const jwt = require('jsonwebtoken');
const { createHash, createCipheriv, createDecipheriv } = require("crypto");
const { bannedUsers, lastLogouts } = require('../admin/config');
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
	windowMs: 300,
	max: 1,
	message: { error: 'SLOW_DOWN' },
	standardHeaders: false,
	legacyHeaders: false,
    keyGenerator: (req, res) => `${req.path}:${req.userId || req.headers['cf-connecting-ip']}`
})

if (typeof process.env.JWT_SECRET !== 'string' || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be set and at least 32 characters long.');
    process.exit(1);
}

const secret = process.env.JWT_SECRET;

const expiresIn = 7 * 24 * 60 * 60;

function generateJwtToken(userId) {
    
    const payload = {
        uid: `${userId}`
    };

    const options = {
        expiresIn: expiresIn // Token will expire in 14 days
    };

    const token = jwt.sign(payload, secret, options);

    return token;

}


function validateJwtToken(token) {

    try {
        const decoded = jwt.verify(token, secret);

        if (lastLogouts[decoded.uid] && lastLogouts[decoded.uid] >= decoded.iat * 1000) {
            return null;
        }

        return decoded;
    } catch (err) {
        // The token was not valid (it was tampered with or it expired)
        // console.log('Token is not valid:', err);
        return null;
    }

}

async function isAuthed(req, res, next) {

    const token = getReqToken(req);
    if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const valid = validateJwtToken(token);
    if (!valid) return res.status(401).json({ error: 'UNAUTHORIZED' });

    if (bannedUsers.has(valid.uid)) return res.status(401).json({ error: 'UNAUTHORIZED' });

    try{const [[u]]=await require('../../database').sql.query('SELECT role,banned FROM users WHERE id=?',[valid.uid]);if(!u||u.banned||String(u.role).trim().toUpperCase()==='BOT')return res.status(403).json({error:'ACCOUNT_RESTRICTED'});req.userId=valid.uid;next();}catch(e){console.error('Authorization:',e.message);res.status(503).json({error:'AUTH_UNAVAILABLE'});}
    
}

function getReqToken(req) {
    return req.headers.authorization || req.cookies.jwt;
}

const alphabet = "abcdefghijklmnopqrstuvwxyz";
let md5 = createHash("md5");

function encrypt(data, key) {
    let salt = "";
    let salted = "";
    let dx = Buffer.alloc(0);

    salt = Array(8)
        .fill(0)
        .map((v) => alphabet[Math.floor(Math.random() * alphabet.length)])
        .join(""); // 8 random letters
    data =
        data +
        Array(17 - (data.length % 16)).join(
            String.fromCharCode(16 - (data.length % 16))
        ); // Padding (pkcs7?)

    for (let x = 0; x < 3; x++) {
        dx = md5
            .update(
                Buffer.concat([
                    Buffer.from(dx),
                    Buffer.from(key),
                    Buffer.from(salt),
                ])
            )
            .digest();

        salted += dx.toString("hex");
        md5 = createHash("md5");
    }

    let aes = createCipheriv(
        "aes-256-cbc",
        Buffer.from(salted, "hex").slice(0, 32),
        Buffer.from(salted, "hex").slice(32, 32 + 16)
    );
    aes.setAutoPadding(false);

    return JSON.stringify({
        ct: aes.update(data, null, "base64") + aes.final("base64"),
        iv: salted.substring(64, 64 + 32),
        s: Buffer.from(salt).toString("hex"),
    });
}

function decrypt(rawData, key) {
    let data = JSON.parse(rawData);

    let dk = Buffer.concat([Buffer.from(key), Buffer.from(data.s, "hex")]);

    let md5 = createHash("md5");
    let arr = [Buffer.from(md5.update(dk).digest()).toString("hex")];
    let result = arr[0];

    for (let x = 1; x < 3; x++) {
        md5 = createHash("md5");
        arr.push(
            Buffer.from(
                md5
                    .update(Buffer.concat([Buffer.from(arr[x - 1], "hex"), dk]))
                    .digest()
            ).toString("hex")
        );
        result += arr[x];
    }

    let aes = createDecipheriv(
        "aes-256-cbc",
        Buffer.from(result, "hex").slice(0, 32),
        Buffer.from(data.iv, "hex")
    );
    return aes.update(data.ct, "base64", "utf8") + aes.final("utf8");
}

module.exports = {
    generateJwtToken,
    validateJwtToken,
    expiresIn,
    apiLimiter,
    getReqToken,
    isAuthed,
    encrypt,
    decrypt
}