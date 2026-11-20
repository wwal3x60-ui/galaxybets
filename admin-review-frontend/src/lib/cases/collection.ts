/** Original collection drafts. These IDs must never be sent to paid game endpoints. */
export type CaseCategory = 'All' | 'CS2' | 'Collectibles' | 'Tech' | 'Lifestyle';
export interface ReviewCase {slug:string;name:string;price:number;category:Exclude<CaseCategory,'All'>;color:string;description:string;featured?:boolean;}
export const caseCollection: ReviewCase[] = [
 {slug:'ignition',name:'Ignition',price:0.99,category:'CS2',color:'#ed6547',description:'The first spark. A sharp introduction to the Crimson collection.',featured:true},
 {slug:'redline',name:'Redline',price:4.99,category:'CS2',color:'#e3414b',description:'Red accents, precision finishes, and a distinctly competitive edge.',featured:true},
 {slug:'carbon',name:'Carbon',price:7.49,category:'CS2',color:'#a1a6ac',description:'Brushed metal, carbon fibre, and understated classics.'},
 {slug:'frostbite',name:'Frostbite',price:9.99,category:'CS2',color:'#8ccbdc',description:'Ice-cold finishes with a clean, glacial silhouette.',featured:true},
 {slug:'venom',name:'Venom',price:12.49,category:'CS2',color:'#a8cb63',description:'Acid green details meet a deep black shell.'},
 {slug:'ultraviolet',name:'Ultraviolet',price:14.99,category:'Collectibles',color:'#a28bd9',description:'A collector’s spectrum of violet and polished chrome.'},
 {slug:'gold-rush',name:'Gold Rush',price:19.99,category:'Lifestyle',color:'#dfb657',description:'Warm metallics and timeless pieces, presented in gold.'},
 {slug:'royal-vault',name:'Royal Vault',price:24.99,category:'Collectibles',color:'#b59ae2',description:'Deep royal tones and a collector-first presentation.'},
 {slug:'dragon-forge',name:'Dragon Forge',price:29.99,category:'CS2',color:'#db694b',description:'Forged details, embossed scales, and fire-red finishes.',featured:true},
 {slug:'midnight',name:'Midnight',price:34.99,category:'Lifestyle',color:'#8c9fb8',description:'After-hours essentials with a darker point of view.'},
 {slug:'hyperdrive',name:'Hyperdrive',price:39.99,category:'Tech',color:'#90b2e1',description:'Performance-minded gear with a precise technical finish.'},
 {slug:'phantom',name:'Phantom',price:44.99,category:'CS2',color:'#b6bdc7',description:'Muted silver, ghosted surfaces, and minimal marks.'},
 {slug:'toxic',name:'Toxic',price:49.99,category:'CS2',color:'#bdd55c',description:'A hard-edged green collection with industrial character.'},
 {slug:'inferno',name:'Inferno',price:59.99,category:'CS2',color:'#f17b4d',description:'Burnished copper and ember-red details.'},
 {slug:'chromatic',name:'Chromatic',price:69.99,category:'Collectibles',color:'#b9b1df',description:'Shifting light, iridescent details, and a polished shell.'},
 {slug:'crimson-elite',name:'Crimson Elite',price:79.99,category:'CS2',color:'#e14c58',description:'The signature red collection. Built to stand apart.',featured:true},
 {slug:'blackout',name:'Blackout',price:99.99,category:'Tech',color:'#b8bdc4',description:'All-black essentials with a considered premium finish.'},
 {slug:'neon-circuit',name:'Neon Circuit',price:124.99,category:'Tech',color:'#82d0cd',description:'Circuit-inspired engraving and carefully chosen tech.'},
 {slug:'collectors-vault',name:'Collector’s Vault',price:149.99,category:'Collectibles',color:'#d6b76d',description:'A showpiece collection for the detail-obsessed.',featured:true},
 {slug:'apex',name:'Apex',price:249.99,category:'Lifestyle',color:'#e5c895',description:'The top of the collection. Sculptural, refined, unmistakable.'},
];
export const caseBySlug=(slug:string)=>caseCollection.find(item=>item.slug===slug);
export const caseImage=(slug:string)=>`/assets/crimson/cases/${slug}.webp`;
export const caseMoney=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export const displayCaseName=(value:string)=>value.replace(/\bpacks\b/gi,'Cases').replace(/\bpack\b/gi,'Case');
export type CaseSort='featured'|'price-low'|'price-high'|'name';
export function filterCases({category='All',search='',sort='featured',min=0,max=Infinity}:{category?:CaseCategory;search?:string;sort?:CaseSort;min?:number;max?:number}={}) {
 const query=search.trim().toLocaleLowerCase();
 return caseCollection.filter(item=>(category==='All'||item.category===category)&&(!query||`${item.name} ${item.category} ${item.description}`.toLocaleLowerCase().includes(query))&&item.price>=min&&item.price<=max).sort((a,b)=>sort==='price-low'?a.price-b.price:sort==='price-high'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name):Number(!!b.featured)-Number(!!a.featured));
}
