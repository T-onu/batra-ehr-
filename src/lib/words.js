const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
const two=n=>n<20?a[n]:b[Math.floor(n/10)]+(n%10?' '+a[n%10]:'')
const three=n=>(n>99?a[Math.floor(n/100)]+' Hundred'+(n%100?' ':''):'')+(n%100?two(n%100):'')
export function words(num){let n=Math.floor(Math.abs(Number(num)||0));if(!n)return 'Zero Rupees Only'
  const p=[[10000000,'Crore'],[100000,'Lakh'],[1000,'Thousand']];let o=[]
  for(const [v,l] of p){if(n>=v){o.push(three(Math.floor(n/v))+' '+l);n%=v}}
  if(n)o.push(three(n));return o.join(' ')+' Rupees Only'}
