import React, { useState, useRef } from 'react';
import { BrandingImages } from '../types';
import { fileToOptimizedDataUrl } from '../utils/imageUtils';
import {
  Upload,
  X,
  Check,
  RotateCcw,
  Image as ImageIcon,
  ShieldCheck,
  Building2,
  Flame,
  AlertTriangle,
} from 'lucide-react';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: BrandingImages;
  onSaveBranding: (updated: BrandingImages) => void;
  initialTab?: 'company' | 'k3' | 'welding';
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  isOpen,
  onClose,
  branding,
  onSaveBranding,
  initialTab = 'company',
}) => {
  const [activeTab, setActiveTab] = useState<'company' | 'k3' | 'welding'>(initialTab);
  const [tempBranding, setTempBranding] = useState<BrandingImages>(branding);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTempBranding(branding);
      setActiveTab(initialTab);
      setErrorMessage(null);
    }
  }, [isOpen, branding, initialTab]);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File, target: 'company' | 'k3' | 'welding') => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('File harus berupa gambar (.png, .jpg, .jpeg, .svg, .webp)');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const dataUrl = await fileToOptimizedDataUrl(file, 1400, 0.88);
      if (target === 'company') {
        setTempBranding((prev) => ({ ...prev, companyLogoUrl: dataUrl }));
      } else if (target === 'k3') {
        setTempBranding((prev) => ({
          ...prev,
          k3PosterUrl: dataUrl,
          useCustomK3Image: true,
        }));
      } else if (target === 'welding') {
        setTempBranding((prev) => ({ ...prev, weldingLogoUrl: dataUrl }));
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Gagal memproses file gambar. Pastikan file valid.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file, activeTab);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, target: 'company' | 'k3' | 'welding') => {
    e.preventDefault();
    setDragOverTab(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file, target);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, target: string) => {
    e.preventDefault();
    setDragOverTab(target);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverTab(null);
  };

  const handleResetCurrent = () => {
    if (activeTab === 'company') {
      setTempBranding((prev) => ({ ...prev, companyLogoUrl: null }));
    } else if (activeTab === 'k3') {
      setTempBranding((prev) => ({
        ...prev,
        k3PosterUrl: null,
        useCustomK3Image: false,
      }));
    } else if (activeTab === 'welding') {
      setTempBranding((prev) => ({ ...prev, weldingLogoUrl: null }));
    }
  };

  const handleSave = () => {
    onSaveBranding(tempBranding);
    onClose();
  };

  return (
    <div
      id="modal-image-upload"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="bg-[#032F73] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl text-[#EA7A2D]">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-tight">
                Kustomisasi Logo &amp; Petunjuk K3
              </h3>
              <p className="text-xs text-blue-200/90 font-normal">
                Unggah gambar logo perusahaan dan poster keselamatan K3 resmi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-b border-slate-200/80">
          <div className="inline-flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl flex-wrap">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                activeTab === 'company'
                  ? 'bg-white text-[#032F73] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#032F73]" />
              <span>Logo Perusahaan</span>
            </button>

            <button
              onClick={() => setActiveTab('k3')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                activeTab === 'k3'
                  ? 'bg-white text-[#032F73] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#EA7A2D]" />
              <span>Petunjuk K3 Asli</span>
            </button>

            <button
              onClick={() => setActiveTab('welding')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all whitespace-nowrap ${
                activeTab === 'welding'
                  ? 'bg-white text-[#032F73] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-[#EA7A2D]" />
              <span>Logo Welding Shop</span>
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGO PERUSAHAAN */}
          {activeTab === 'company' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Logo Perusahaan (Pupuk Kaltim)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tampil di sudut kiri atas header utama dashboard
                  </p>
                </div>
                <span className={`text-xs font-semibold ${tempBranding.companyLogoUrl ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {tempBranding.companyLogoUrl ? 'Gambar Kustom Aktif' : 'Format Standar Vektor'}
                </span>
              </div>

              <div className="p-4 bg-[#F4F7FB] border border-slate-200/80 rounded-xl flex items-center justify-center min-h-[110px]">
                {tempBranding.companyLogoUrl ? (
                  <img
                    src={tempBranding.companyLogoUrl}
                    alt="Logo Perusahaan Kustom"
                    referrerPolicy="no-referrer"
                    className="max-h-20 max-w-full object-contain rounded"
                  />
                ) : (
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200">
                    <div className="w-9 h-9 rounded-full bg-[#032F73] flex items-center justify-center text-white font-bold text-xs">
                      PKT
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#032F73] font-extrabold text-sm">PUPUK KALTIM</span>
                      <span className="text-slate-500 text-[10px] font-medium">
                        SBU Jasa Pelayanan Pabrik (Standar)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div
                onDrop={(e) => handleDrop(e, 'company')}
                onDragOver={(e) => handleDragOver(e, 'company')}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  dragOverTab === 'company'
                    ? 'border-[#032F73] bg-blue-50/60'
                    : 'border-slate-300 bg-[#F8FAFC] hover:border-[#032F73] hover:bg-blue-50/30'
                }`}
              >
                <Upload className="w-7 h-7 text-[#032F73] mb-2" />
                <span className="font-semibold text-sm text-slate-800 text-center">
                  Tarik &amp; letakkan gambar logo di sini, atau klik untuk memilih file
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Mendukung PNG, JPG, JPEG, SVG, WebP (Disarankan PNG transparan)
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PETUNJUK K3 */}
          {activeTab === 'k3' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Poster / Gambar Petunjuk K3 Asli
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tampil pada panel vertikal kiri di bawah counter Job Aktif
                  </p>
                </div>
                <span className={`text-xs font-semibold ${tempBranding.k3PosterUrl && tempBranding.useCustomK3Image ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {tempBranding.k3PosterUrl && tempBranding.useCustomK3Image ? 'Poster Asli Aktif' : 'Ikon Vektor Standar'}
                </span>
              </div>

              {tempBranding.k3PosterUrl && (
                <div className="flex items-center justify-between bg-[#FFF8F3] border border-[#EA7A2D]/25 rounded-xl p-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#D96B1F]">
                      Mode Tampilan K3
                    </span>
                    <span className="text-xs text-slate-600">
                      Pilih apakah ingin menampilkan gambar poster asli atau ikon vektor
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setTempBranding((prev) => ({
                        ...prev,
                        useCustomK3Image: !prev.useCustomK3Image,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      tempBranding.useCustomK3Image
                        ? 'bg-[#EA7A2D] text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tempBranding.useCustomK3Image
                      ? 'Menampilkan Gambar Asli'
                      : 'Menampilkan Ikon Vektor'}
                  </button>
                </div>
              )}

              <div className="p-4 bg-[#F4F7FB] border border-slate-200/80 rounded-xl flex items-center justify-center min-h-[160px] max-h-[220px] overflow-hidden">
                {tempBranding.k3PosterUrl ? (
                  <img
                    src={tempBranding.k3PosterUrl}
                    alt="Poster K3 Asli"
                    referrerPolicy="no-referrer"
                    className="max-h-[190px] w-auto object-contain rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="flex flex-col items-center text-center p-4">
                    <ShieldCheck className="w-9 h-9 text-[#EA7A2D] mb-1.5" />
                    <span className="text-xs font-medium text-slate-600 max-w-md">
                      Format Standar: 4 Ikon Lingkaran K3 Oranye (Helm, Sarung Tangan, Sepatu, Kebersihan) + Perisai Safety First
                    </span>
                  </div>
                )}
              </div>

              <div
                onDrop={(e) => handleDrop(e, 'k3')}
                onDragOver={(e) => handleDragOver(e, 'k3')}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  dragOverTab === 'k3'
                    ? 'border-[#EA7A2D] bg-orange-50/60'
                    : 'border-slate-300 bg-[#F8FAFC] hover:border-[#EA7A2D] hover:bg-orange-50/30'
                }`}
              >
                <Upload className="w-7 h-7 text-[#EA7A2D] mb-2" />
                <span className="font-semibold text-sm text-slate-800 text-center">
                  Tarik &amp; letakkan gambar poster K3 asli di sini, atau klik untuk memilih
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Mendukung foto/scan poster keselamatan resmi workshop (PNG, JPG, WebP)
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: LOGO WELDING SHOP */}
          {activeTab === 'welding' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    Logo Welding Shop / SBU
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tampil di sudut kanan atas header dashboard
                  </p>
                </div>
                <span className={`text-xs font-semibold ${tempBranding.weldingLogoUrl ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {tempBranding.weldingLogoUrl ? 'Gambar Kustom Aktif' : 'Format Standar Vektor'}
                </span>
              </div>

              <div className="p-4 bg-[#F4F7FB] border border-slate-200/80 rounded-xl flex items-center justify-center min-h-[110px]">
                {tempBranding.weldingLogoUrl ? (
                  <img
                    src={tempBranding.weldingLogoUrl}
                    alt="Logo Welding Shop Kustom"
                    referrerPolicy="no-referrer"
                    className="max-h-20 max-w-full object-contain rounded"
                  />
                ) : (
                  <div className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-lg border border-slate-200">
                    <div className="w-9 h-9 rounded-md bg-[#032F73] flex items-center justify-center text-[#EA7A2D]">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#EA7A2D] font-extrabold text-sm">WELDING SHOP</span>
                      <span className="text-[#032F73] text-[10px] font-semibold">
                        Workshop &amp; Fabrication (Standar)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div
                onDrop={(e) => handleDrop(e, 'welding')}
                onDragOver={(e) => handleDragOver(e, 'welding')}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  dragOverTab === 'welding'
                    ? 'border-[#032F73] bg-blue-50/60'
                    : 'border-slate-300 bg-[#F8FAFC] hover:border-[#032F73] hover:bg-blue-50/30'
                }`}
              >
                <Upload className="w-7 h-7 text-[#032F73] mb-2" />
                <span className="font-semibold text-sm text-slate-800 text-center">
                  Tarik &amp; letakkan logo welding di sini, atau klik untuk memilih file
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Mendukung PNG, JPG, JPEG, SVG, WebP
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F8FAFC] px-6 py-3.5 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetCurrent}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kembalikan Standar</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#032F73] hover:bg-[#022154] text-white text-xs font-bold transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
