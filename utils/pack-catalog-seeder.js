'use strict';
async function seedCatalog(connection,catalog){
        let inserted=0,unchanged=0;
        for(const pack of catalog.packs){
            const [[existing]]=await connection.query('SELECT CAST(id AS CHAR) AS id, name, img FROM cases WHERE slug = ? FOR UPDATE',[pack.slug]);
            if(existing){
                const [versions]=await connection.query('SELECT CAST(id AS CHAR) AS id, CAST(price AS CHAR) AS price FROM caseVersions WHERE caseId = ? AND endedAt IS NULL FOR UPDATE',[existing.id]);
                if(existing.name!==pack.name||existing.img!==pack.image||versions.length!==1||String(versions[0].price)!==String(pack.priceCents))throw Error('Existing pack differs; no overwrite attempted: '+pack.slug);
                const [items]=await connection.query('SELECT name, img, CAST(price AS CHAR) AS price, rangeFrom, rangeTo FROM caseItems WHERE caseVersionId = ? ORDER BY rangeFrom FOR UPDATE',[versions[0].id]);
                if(items.length!==pack.items.length||items.some((item,i)=>item.name!==pack.items[i].name||item.img!==pack.items[i].image||String(item.price)!==String(pack.items[i].valueCents)||Number(item.rangeFrom)!==pack.items[i].rangeFrom||Number(item.rangeTo)!==pack.items[i].rangeTo))throw Error('Existing rewards differ; no overwrite attempted: '+pack.slug);
                unchanged++;continue;
            }
            await connection.query('INSERT INTO cases (name, slug, img) VALUES (?, ?, ?)',[pack.name,pack.slug,pack.image]);
            const [[created]]=await connection.query('SELECT CAST(id AS CHAR) AS id FROM cases WHERE slug = ?',[pack.slug]);
            await connection.query('INSERT INTO caseVersions (caseId, price) VALUES (?, ?)',[created.id,pack.priceCents]);
            const [[version]]=await connection.query('SELECT CAST(id AS CHAR) AS id FROM caseVersions WHERE caseId = ? AND endedAt IS NULL',[created.id]);
            for(const item of pack.items)await connection.query('INSERT INTO caseItems (caseVersionId, robloxId, name, img, price, robloxPrice, rangeFrom, rangeTo) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',[version.id,item.catalogId,item.name,item.image,item.valueCents,item.rangeFrom,item.rangeTo]);
            inserted++;
        }

    return {inserted,unchanged};
}
module.exports={seedCatalog};
