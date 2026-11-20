import React from 'react';
import { Camera } from 'lucide-react';

interface LogoProps {
  className?: string;
  customLogoUrl?: string | null;
  onClickUpload?: () => void;
}

export const PupukKaltimLogo: React.FC<LogoProps> = ({
  className = 'h-12',
  customLogoUrl,
  onClickUpload,
}) => {
  return (
    <div
      id="brand-pupuk-kaltim"
      onClick={onClickUpload}
      title={onClickUpload ? 'Klik untuk ganti / upload logo asli' : undefined}
      className={`group relative flex items-center gap-3 px-2 py-1 rounded-xl select-none transition-colors ${
        onClickUpload ? 'cursor-pointer hover:bg-slate-50' : ''
      } ${className}`}
    >
      {customLogoUrl ? (
        <div className="flex items-center gap-2 max-h-12">
          <img
            src={customLogoUrl}
            alt="Logo Perusahaan"
            referrerPolicy="no-referrer"
            className="max-h-11 max-w-[230px] object-contain"
          />
        </div>
      ) : (
        <>
          {/* Emblem Pupuk Kaltim Standar */}
          <div className="relative w-10 h-10 lg:w-11 lg:h-11 flex-shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path
                d="M 50 8 C 24 8 12 24 12 50 C 12 76 28 92 50 94 C 72 92 88 76 88 50 C 88 24 76 8 50 8 Z"
                fill="#032F73"
              />
              <path
                d="M 50 14 C 28 14 18 28 18 50 C 18 72 32 86 50 88 C 68 86 82 72 82 50 C 82 28 72 14 50 14 Z"
                fill="none"
                stroke="#EA7A2D"
                strokeWidth="2.5"
              />
              <path
                d="M 50 20 C 38 28 32 44 38 60 C 44 70 50 78 50 78 C 50 78 56 70 62 60 C 68 44 62 28 50 20 Z"
                fill="#10B981"
              />
              <path
                d="M 50 30 C 43 38 42 48 46 56 C 48 60 50 64 50 64 C 50 64 52 60 54 56 C 58 48 57 38 50 30 Z"
                fill="#EA7A2D"
              />
              <circle cx="50" cy="48" r="3.5" fill="#FFFFFF" />
            </svg>
          </div>

          <div className="flex flex-col leading-none">
            <span className="text-[#032F73] text-base lg:text-lg font-extrabold font-display tracking-wide">
              PUPUK KALTIM
            </span>
            <span className="text-[#EA7A2D] text-[10px] font-bold uppercase mt-1 tracking-wider">
              SBU Jasa Pelayanan Pabrik
            </span>
          </div>
        </>
      )}

      {onClickUpload && (
        <div className="absolute -top-1 -right-1 bg-[#032F73] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-xs">
          <Camera className="w-3 h-3" />
        </div>
      )}
    </div>
  );
};

export const WeldingShopLogo: React.FC<LogoProps> = ({
  className = 'h-12',
  customLogoUrl,
  onClickUpload,
}) => {
  return (
    <div
      id="brand-welding-shop"
      onClick={onClickUpload}
      title={onClickUpload ? 'Klik untuk ganti / upload logo welding shop' : undefined}
      className={`group relative flex items-center gap-2.5 px-2 py-1 rounded-xl select-none transition-colors ${
        onClickUpload ? 'cursor-pointer hover:bg-slate-50' : ''
      } ${className}`}
    >
      {customLogoUrl ? (
        <div className="flex items-center gap-2 max-h-12">
          <img
            src={customLogoUrl}
            alt="Logo Welding Shop"
            referrerPolicy="no-referrer"
            className="max-h-11 max-w-[200px] object-contain"
          />
        </div>
      ) : (
        <>
          <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-lg bg-[#032F73] flex items-center justify-center p-2 flex-shrink-0">
            <svg viewBox="0 0 48 48" className="w-full h-full">
              <path
                d="M6 40 L6 22 L14 26 L14 22 L22 26 L22 18 L32 18 L32 40 Z"
                fill="#FFFFFF"
              />
              <path d="M26 10 L28 14 M30 7 L31 13" stroke="#EA7A2D" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="36" cy="28" r="3" fill="#EA7A2D" />
              <path d="M36 21 L36 35 M29 28 L43 28 M31 23 L41 33 M31 33 L41 23" stroke="#EA7A2D" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex flex-col leading-none">
            <span className="text-[#EA7A2D] text-base lg:text-lg font-extrabold font-display tracking-wide">
              WELDING SHOP
            </span>
            <span className="text-[#032F73] text-[10px] font-bold uppercase mt-1 tracking-wider">
              Workshop &amp; Fabrication
            </span>
          </div>
        </>
      )}

      {onClickUpload && (
        <div className="absolute -top-1 -right-1 bg-[#EA7A2D] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-xs">
          <Camera className="w-3 h-3" />
        </div>
      )}
    </div>
  );
};
