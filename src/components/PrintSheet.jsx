import { Printer, X } from 'lucide-react'
export default function PrintSheet({title,meta=[],onClose,children}){
  return <div className="fixed inset-0 z-40 overflow-auto bg-slate-900/50 p-4 backdrop-blur-sm"><div className="mx-auto max-w-3xl">
    <div className="no-print mb-3 flex justify-end gap-2"><button className="btn" onClick={()=>window.print()}><Printer size={16}/>Print / PDF</button><button className="btn !bg-white !text-navy" onClick={onClose}><X size={16}/>Close</button></div>
    <div className="print-area card space-y-4 p-8 text-sm">
      <div className="flex items-center gap-4 border-b-2 border-navy pb-4"><img src="/logo.png" width="64" height="64" className="rounded-full" alt=""/>
        <div className="flex-1"><div className="text-2xl font-extrabold text-navy">Batra Eye Hospital</div><div className="text-xs text-slate-500">Mukerian · Emergency: 8295954631 / 8427808384</div></div>
        <div className="text-right text-xs"><b className="text-base text-navy">{title}</b>{meta.map((m,i)=><div key={i}>{m}</div>)}</div></div>
      {children}</div></div></div>
}
