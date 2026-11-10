'use strict';
function units(value){const text=String(value);const m=/^(\d+)(?:\.(\d{1,2}))?$/.exec(text);if(!m)throw Error('Invalid money amount');return BigInt(m[1]+(m[2]||'').padEnd(2,'0'));}
function decimal(value){const s=value.toString().padStart(3,'0');return s.slice(0,-2)+'.'+s.slice(-2);}
module.exports={units,decimal};
