'use strict';
function validateCatalog(catalog) {
    const counts={Pokemon:0,CSGO:0,IRL:0},slugs=new Set();
    if(catalog.packs?.length!==40)throw Error('Expected 40 packs');
    for(const pack of catalog.packs){
        if(!Object.hasOwn(counts,pack.category))throw Error('Invalid category');counts[pack.category]++;
        if(!/^(pokemon|csgo|irl)-[a-z0-9-]+$/.test(pack.slug)||slugs.has(pack.slug))throw Error('Invalid or duplicate slug');slugs.add(pack.slug);
        if(!Number.isSafeInteger(pack.priceCents)||pack.priceCents<100||pack.priceCents>50000)throw Error('Price outside $1-$500');
        let next=1,total=0n;
        if(pack.items.length!==10)throw Error('Expected 10 rewards per pack');
        for(const item of pack.items){
            if(!Number.isSafeInteger(item.valueCents)||item.valueCents<0||item.rangeFrom!==next||item.rangeTo<item.rangeFrom)throw Error('Invalid reward or ticket gap');
            const tickets=item.rangeTo-item.rangeFrom+1;
            if(tickets!==item.tickets)throw Error('Ticket count mismatch');
            next=item.rangeTo+1;total+=BigInt(item.valueCents)*BigInt(tickets);
        }
        if(next!==100001||total!==BigInt(pack.priceCents)*90000n)throw Error('Pack does not have exactly 90% expected return');
    }
    if(counts.Pokemon!==10||counts.CSGO!==10||counts.IRL!==20)throw Error('Wrong category counts');
    return counts;
}
module.exports={validateCatalog};
