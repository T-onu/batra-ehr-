export const ROLES=['Super Admin','Admin','Doctor','Reception']
const ADMIN_ONLY=['users','audit']
const EVERYTHING=['dashboard','patients','appointments','queue','clinical','diagnostics','ipd','discharge','documents','billing','receipts','pharmacy','optical','reports']
export const ACCESS={
  'Super Admin':[...EVERYTHING,...ADMIN_ONLY],
  Admin:EVERYTHING,
  Doctor:['dashboard','patients','appointments','queue','clinical','diagnostics','ipd','discharge','documents'],
  Reception:['dashboard','patients','appointments','queue','optical','documents']}
export const can=(role,page)=>(ACCESS[role]||ACCESS.Reception).includes(page)
// Roles that may handle money (receive payments, IPD billing, stock)
export const isBilling=role=>role==='Admin'||role==='Super Admin'
