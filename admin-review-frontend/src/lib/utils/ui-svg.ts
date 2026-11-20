const cache=new Map<string,Promise<string>>();
export function loadUiSvg(name:string):Promise<string>{
 if(!/^[A-Za-z0-9_-]+$/.test(name))return Promise.reject(new Error('Invalid icon name'));
 const saved=cache.get(name);if(saved)return saved;
 const request=fetch(`/assets/icons/${name}.svg`).then(async response=>{
  if(!response.ok)throw new Error('Icon unavailable');
  const text=await response.text();
  const doc=new DOMParser().parseFromString(text,'image/svg+xml');
  const root=doc.documentElement;
  if(root.localName!=='svg'||doc.querySelector('parsererror'))throw new Error('Invalid SVG response');
  root.querySelectorAll('script,foreignObject,iframe,object,embed,image,style,animate,set,animateMotion,animateTransform').forEach(n=>n.remove());
  for(const el of [root,...Array.from(root.querySelectorAll('*'))]){
   for(const attr of Array.from(el.attributes)){
    if(/^on/i.test(attr.name)||((attr.name==='href'||attr.name==='xlink:href')&&!attr.value.startsWith('#'))||/javascript:|url\(\s*["']?https?:/i.test(attr.value))el.removeAttribute(attr.name);
   }
  }
  return new XMLSerializer().serializeToString(root);
 });
 cache.set(name,request);return request;
}
