export const ROLES=['Super Admin','Admin','Doctor','Reception','Billing','Pharmacy','Optical']
const ALL='*'
export const ACCESS={ 'Super Admin':ALL, Admin:ALL,
  Doctor:['dashboard','patients','queue','clinical','diagnostics','ipd','discharge','documents'],
  Reception:['dashboard','patients','appointments','queue','billing','diagnostics','documents'],
  Billing:['dashboard','patients','billing','ipd','discharge','reports','diagnostics','documents'],
  Pharmacy:['dashboard','pharmacy'], Optical:['dashboard','optical'] }
export const can=(role,page)=>{const a=ACCESS[role]||ACCESS.Reception;return a===ALL||a.includes(page)}
