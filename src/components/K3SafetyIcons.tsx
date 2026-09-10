import React from 'react';

interface K3Item {
  id: string;
  label: string;
  svg: React.ReactNode;
}

export const K3SafetyIcons: React.FC = () => {
  const k3List: K3Item[] = [
    {
      id: 'helm',
      label: 'GUNAKAN HELM',
      svg: (
        <svg viewBox="0 0 48 48" className="w-7 h-7 fill-white">
          {/* Safety Helmet Pictogram */}
          <path d="M12 28 C12 18 18 12 24 12 C30 12 36 18 36 28 L38 30 C39 31 38 32 37 32 L11 32 C10 32 9 31 10 30 Z" />
          <path d="M22 12 L22 28 M26 12 L26 28" stroke="#EA7A2D" strokeWidth="1.5" />
          <path d="M8 32 L40 32" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'gloves',
      label: 'GUNAKAN SARUNG TANGAN',
      svg: (
        <svg viewBox="0 0 48 48" className="w-7 h-7 fill-white">
          {/* Gloves Pictogram */}
          <path d="M15 36 L15 26 C15 23 18 23 18 26 L18 20 C18 17 21 17 21 20 L21 18 C21 15 24 15 24 18 L24 20 C24 17 27 17 27 20 L27 28 C27 25 31 26 31 29 C31 33 29 36 26 39 L15 39 Z" />
          <rect x="13" y="37" width="18" height="4" rx="1" fill="white" />
        </svg>
      ),
    },
    {
      id: 'shoes',
      label: 'GUNAKAN SAFETY SHOES',
      svg: (
        <svg viewBox="0 0 48 48" className="w-7 h-7 fill-white">
          {/* Safety Shoes Pictogram */}
          <path d="M14 14 L22 14 L22 24 L32 26 C36 27 38 30 38 34 L38 36 L10 36 L10 16 C10 14 12 14 14 14 Z" />
          <rect x="9" y="36" width="30" height="3" rx="1" fill="#EA7A2D" stroke="white" strokeWidth="1" />
        </svg>
      ),
    },
    {
      id: 'kebersihan',
      label: 'JAGA KEBERSIHAN',
      svg: (
        <svg viewBox="0 0 48 48" className="w-7 h-7 fill-white">
          {/* Broom / Cleanliness / Trash bin Pictogram */}
          <path d="M18 10 L30 10 L30 14 L18 14 Z" />
          <path d="M16 16 L32 16 L30 38 C30 39 29 40 28 40 L20 40 C19 40 18 39 18 38 Z" />
          <path d="M22 20 L22 34 M26 20 L26 34" stroke="#EA7A2D" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col items-center justify-between w-full h-full gap-2 px-1 py-1">
      {/* 4 K3 Circles in Orange (#EA7A2D) + White Pictograms + Orange Captions */}
      <div className="flex flex-col gap-2.5 w-full items-center justify-around flex-1">
        {k3List.map((item) => (
          <div
            key={item.id}
            id={`k3-item-${item.id}`}
            className="flex flex-col items-center justify-center text-center group cursor-default w-full"
          >
            {/* Lingkaran Oranye #EA7A2D berukuran lebih besar */}
            <div className="w-12 h-12 lg:w-13 lg:h-13 rounded-full bg-[#EA7A2D] flex items-center justify-center shadow-md border-2 border-white/95 group-hover:scale-105 transition-transform">
              {item.svg}
            </div>
            {/* Teks Oranye di bawahnya */}
            <span className="text-[10px] lg:text-[11px] font-black text-[#EA7A2D] uppercase tracking-wider mt-1 text-center font-inter drop-shadow-sm leading-tight">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Perisai Kuning / Orange di Bagian Bawah dengan Tulisan SAFETY FIRST */}
      <div
        id="k3-perisai-safety-first"
        className="w-full mt-1 p-2 rounded-xl bg-gradient-to-b from-[#F59E0B] via-[#EA7A2D] to-[#D97706] border-2 border-yellow-300 shadow-md flex flex-col items-center text-center select-none"
      >
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow">
            {/* Green / Orange Cross */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#032F73]">
              <rect x="9" y="3" width="6" height="18" rx="1" />
              <rect x="3" y="9" width="18" height="6" rx="1" />
            </svg>
          </div>
          <span className="text-white font-black text-xs lg:text-sm tracking-widest uppercase font-inter">
            SAFETY FIRST
          </span>
        </div>
        <div className="text-[9px] font-extrabold text-blue-950 uppercase tracking-widest mt-0.5 font-inter">
          UTAMAKAN KESELAMATAN KERJA
        </div>
      </div>
    </div>
  );
};
