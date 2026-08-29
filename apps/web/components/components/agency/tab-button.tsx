"use client";
import type { ReactNode } from "react";
interface TabButtonProps { active:boolean; children:ReactNode; onClick:()=>void; icon?:ReactNode; badge?:number; }
export function TabButton({active,children,onClick,icon,badge}:TabButtonProps){return <button type="button" onClick={onClick} className={`group flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${active?"bg-white text-[#120D19] shadow-[0_6px_24px_rgba(0,0,0,.22)]":"text-white/35 hover:bg-white/[0.04] hover:text-white/75"}`}>{icon}<span>{children}</span>{typeof badge==="number"&&badge>0?<span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-black ${active?"bg-black/10":"bg-white/[0.07] text-white/50"}`}>{badge}</span>:null}</button>}
