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

  // Sync temp state when opened
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
    // reset input so the same file can be re-selected if needed
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="bg-[#032F73] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <ImageIcon className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-wide uppercase font-sans">
                Kustomisasi Logo & Petunjuk K3
              </h3>
              <p className="text-xs text-blue-200 font-medium">
                Unggah gambar asli perusahaan dan poster instruksi keselamatan K3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'company'
                ? 'bg-white text-[#032F73] border-[#032F73] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#032F73]" />
            <span>Logo Perusahaan</span>
            {tempBranding.companyLogoUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('k3')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'k3'
                ? 'bg-white text-[#EA7A2D] border-[#EA7A2D] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#EA7A2D]" />
            <span>Petunjuk K3 Asli</span>
            {tempBranding.k3PosterUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('welding')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-bold text-xs uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'welding'
                ? 'bg-white text-[#032F73] border-[#032F73] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Flame className="w-4 h-4 text-[#EA7A2D]" />
            <span>Logo Welding Shop</span>
            {tempBranding.weldingLogoUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Hidden File Input */}
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
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGO PERUSAHAAN */}
          {activeTab === 'company' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Logo Perusahaan (Pupuk Kaltim)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tampil di sudut kiri atas header utama dashboard
                  </p>
                </div>
                {tempBranding.companyLogoUrl ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    Gambar Kustom Aktif
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                    Format Standar Vektor
                  </span>
                )}
              </div>

              {/* Preview Box */}
              <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center min-h-[110px]">
                {tempBranding.companyLogoUrl ? (
                  <img
                    src={tempBranding.companyLogoUrl}
                    alt="Logo Perusahaan Kustom"
                    className="max-h-20 max-w-full object-contain drop-shadow-sm rounded"
                  />
                ) : (
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-300 shadow-xs">
                    <div className="w-9 h-9 rounded-full bg-[#032F73] flex items-center justify-center text-white font-black text-xs">
                      PKT
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#032F73] font-black text-sm">PUPUK KALTIM</span>
                      <span className="text-slate-500 text-[9px] font-bold">
                        SBU JASA PELAYANAN PABRIK (STANDAR)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Dropzone */}
              <div
                onDrop={(e) => handleDrop(e, 'company')}
                onDragOver={(e) => handleDragOver(e, 'company')}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragOverTab === 'company'
                    ? 'border-[#032F73] bg-blue-50/60'
                    : 'border-slate-300 hover:border-[#032F73] hover:bg-slate-50'
                }`}
              >
                <Upload className="w-8 h-8 text-[#032F73] mb-2" />
                <span className="font-bold text-sm text-slate-700">
                  Tarik & letakkan gambar logo di sini, atau klik untuk memilih file
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Mendukung PNG, JPG, JPEG, SVG, WebP (Disarankan PNG transparan)
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PETUNJUK K3 */}
          {activeTab === 'k3' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Poster / Gambar Petunjuk K3 Asli
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tampil pada panel vertikal kiri di bawah counter Job Aktif
                  </p>
                </div>
                {tempBranding.k3PosterUrl && tempBranding.useCustomK3Image ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    Poster Asli Aktif
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                    Ikon Vektor Standar
                  </span>
                )}
              </div>

              {/* Switch / Mode toggle if poster uploaded */}
              {tempBranding.k3PosterUrl && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-[#EA7A2D] uppercase">
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      tempBranding.useCustomK3Image
                        ? 'bg-[#EA7A2D] text-white shadow-xs'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tempBranding.useCustomK3Image
                      ? '✓ Menampilkan Gambar Asli'
                      : 'Menampilkan Ikon Vektor'}
                  </button>
                </div>
              )}

              {/* Preview Box */}
              <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center min-h-[160px] max-h-[220px] overflow-hidden">
                {tempBranding.k3PosterUrl ? (
                  <div className="relative group max-h-[200px] flex items-center justify-center">
                    <img
                      src={tempBranding.k3PosterUrl}
                      alt="Poster K3 Asli"
                      className="max-h-[190px] w-auto object-contain rounded-lg shadow-md border border-slate-300"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center p-4">
                    <ShieldCheck className="w-10 h-10 text-[#EA7A2D] mb-1" />
                    <span className="text-xs font-bold text-slate-700">
                      Format Standar: 4 Ikon Lingkaran K3 Oranye (Helm, Sarung Tangan, Sepatu,
                      Kebersihan) + Perisai Safety First
                    </span>
                  </div>
                )}
              </div>

              {/* Upload Dropzone */}
              <div
                onDrop={(e) => handleDrop(e, 'k3')}
                onDragOver={(e) => handleDragOver(e, 'k3')}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragOverTab === 'k3'
                    ? 'border-[#EA7A2D] bg-orange-50/60'
                    : 'border-slate-300 hover:border-[#EA7A2D] hover:bg-slate-50'
                }`}
              >
                <Upload className="w-8 h-8 text-[#EA7A2D] mb-2" />
                <span className="font-bold text-sm text-slate-700">
                  Tarik & letakkan gambar poster / petunjuk K3 asli di sini, atau klik untuk memilih
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Mendukung foto/scan poster keselamatan resmi workshop (PNG, JPG, WebP)
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: LOGO WELDING SHOP */}
          {activeTab === 'welding' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Logo Welding Shop / SBU
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tampil di sudut kanan atas header dashboard
                  </p>
                </div>
                {tempBranding.weldingLogoUrl ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    Gambar Kustom Aktif
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                    Format Standar Vektor
                  </span>
                )}
              </div>

              {/* Preview Box */}
              <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center min-h-[110px]">
                {tempBranding.weldingLogoUrl ? (
                  <img
                    src={tempBranding.weldingLogoUrl}
                    alt="Logo Welding Shop Kustom"
                    className="max-h-20 max-w-full object-contain drop-shadow-sm rounded"
                  />
                ) : (
                  <div className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-lg border border-slate-300 shadow-xs">
                    <div className="w-9 h-9 rounded-md bg-[#032F73] flex items-center justify-center text-[#EA7A2D] font-black text-xs">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#EA7A2D] font-black text-sm">WELDING SHOP</span>
                      <span className="text-[#032F73] text-[9px] font-extrabold tracking-widest">
                        WORKSHOP & FABRICATION (STANDAR)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Dropzone */}
              <div
                onDrop={(e) => handleDrop(e, 'welding')}
                onDragOver={(e) => handleDragOver(e, 'welding')}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  dragOverTab === 'welding'
                    ? 'border-[#032F73] bg-blue-50/60'
                    : 'border-slate-300 hover:border-[#032F73] hover:bg-slate-50'
                }`}
              >
                <Upload className="w-8 h-8 text-[#032F73] mb-2" />
                <span className="font-bold text-sm text-slate-700">
                  Tarik & letakkan logo welding di sini, atau klik untuk memilih file
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Mendukung PNG, JPG, JPEG, SVG, WebP
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetCurrent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kembalikan Tab Ini ke Standar</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#032F73] hover:bg-blue-900 text-white text-xs font-black tracking-wide shadow-md transition-all"
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
