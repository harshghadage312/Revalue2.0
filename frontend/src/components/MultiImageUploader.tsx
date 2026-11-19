import React, { useState, useRef } from 'react';
import {
  Upload, Trash2, Camera, Star, AlertCircle, CheckCircle2,
  Sparkles, RefreshCw, Eye, ShieldCheck
} from 'lucide-react';
import { api, resolveMediaUrl } from '../services/api';
import { MobileCondition, ProductCondition } from '../types';
import { getConditionMeta } from '../utils/formatters';

const MAX_IMAGES = 6; // Respects backend MAX_IMAGES_PER_LISTING setting
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface UploadItem {
  id: string;
  url: string;
  file?: File;
  uploading?: boolean;
  error?: string;
}

interface MultiImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onConditionDetected?: (condition: ProductCondition, confidence: number) => void;
  currentCondition: ProductCondition;
}

export const MultiImageUploader: React.FC<MultiImageUploaderProps> = ({
  images,
  onImagesChange,
  onConditionDetected,
  currentCondition,
}) => {
  const [fileMap, setFileMap] = useState<Record<string, File>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [scanningImage, setScanningImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    url: string;
    condition: ProductCondition;
    confidence: number;
    probabilities?: Record<string, number>;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    setUploadError(null);
    const validFiles: File[] = [];

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setUploadError(`Maximum ${MAX_IMAGES} photos allowed per listing.`);
      return;
    }

    const filesToConsider = Array.from(files).slice(0, remainingSlots);

    for (const f of filesToConsider) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setUploadError(`'${f.name}' has invalid file type. Allowed formats: JPEG, PNG, WebP.`);
        return;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(`'${f.name}' exceeds the 5MB file size limit.`);
        return;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    setUploadingCount(prev => prev + validFiles.length);

    // Upload in parallel
    const uploadedUrls: string[] = [];
    const newFileEntries: Record<string, File> = {};

    for (const file of validFiles) {
      try {
        const res = await api.uploadImage(file);
        uploadedUrls.push(res.image_url);
        newFileEntries[res.image_url] = file;
      } catch (err: any) {
        setUploadError(err.message || `Failed to upload '${file.name}'.`);
      } finally {
        setUploadingCount(prev => Math.max(0, prev - 1));
      }
    }

    if (uploadedUrls.length > 0) {
      onImagesChange([...images, ...uploadedUrls]);
      setFileMap(prev => ({ ...prev, ...newFileEntries }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const urlToRemove = images[indexToRemove];
    const newImages = images.filter((_, idx) => idx !== indexToRemove);
    onImagesChange(newImages);

    if (scanResult && scanResult.url === urlToRemove) {
      setScanResult(null);
    }
    const updatedMap = { ...fileMap };
    delete updatedMap[urlToRemove];
    setFileMap(updatedMap);
  };

  const handleSetCover = (index: number) => {
    if (index === 0) return;
    const item = images[index];
    const remaining = images.filter((_, idx) => idx !== index);
    onImagesChange([item, ...remaining]);
  };

  const handleScanPhoto = async (imgUrl: string) => {
    const file = fileMap[imgUrl];
    if (!file) {
      setUploadError('Local image reference expired. Please re-upload or select another photo to scan.');
      return;
    }

    setScanningImage(imgUrl);
    setUploadError(null);
    try {
      const data = await api.assessCondition(file);
      if (data?.predicted_condition) {
        const detectedCond = data.predicted_condition as ProductCondition;
        const confidence = data.confidence_score || 0.85;
        setScanResult({
          url: imgUrl,
          condition: detectedCond,
          confidence,
          probabilities: data.class_probabilities,
        });
      } else {
        setUploadError(data.error_message || 'MobileNetV2 could not conclusively classify this photo. Please ensure clear lighting.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'MobileNetV2 condition assessment failed.');
    } finally {
      setScanningImage(null);
    }
  };

  const handleApplyDetectedCondition = () => {
    if (scanResult && onConditionDetected) {
      onConditionDetected(scanResult.condition, scanResult.confidence);
    }
  };

  return (
    <div className="space-y-4">
      {/* Photo Guidelines Tip Banner */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Photos ({images.length}/{MAX_IMAGES}) • Include: 1. Screen illuminated, 2. Back casing, 3. Corners & ports.
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium shrink-0">
          First photo is primary cover
        </span>
      </div>

      {uploadError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-medium">{uploadError}</span>
        </div>
      )}

      {/* Grid of Uploaded Images + Dropzone */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((imgUrl, index) => {
          const isCover = index === 0;
          const isScanningThis = scanningImage === imgUrl;
          const resolvedSrc = resolveMediaUrl(imgUrl);
          const hasLocalFile = Boolean(fileMap[imgUrl]);

          return (
            <div
              key={imgUrl + index}
              className={`group relative aspect-square rounded-xl bg-slate-100 border overflow-hidden p-1 transition-all ${
                isCover ? 'border-emerald-600 ring-2 ring-emerald-600/30 shadow-xs' : 'border-slate-200'
              }`}
            >
              <img
                src={resolvedSrc}
                alt={`Device upload ${index + 1}`}
                className="w-full h-full object-contain rounded-lg"
              />

              {/* Cover Badge */}
              {isCover && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9.5px] font-extrabold flex items-center gap-1 shadow-xs">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span>Cover</span>
                </div>
              )}

              {/* Action Overlay */}
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-between items-center">
                  {!isCover && (
                    <button
                      type="button"
                      onClick={() => handleSetCover(index)}
                      title="Set as Cover Photo"
                      className="px-2 py-1 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold rounded shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                      <span>Set Cover</span>
                    </button>
                  )}
                  <span />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    title="Remove Photo"
                    className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-2xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* MobileNetV2 Scan Button */}
                {hasLocalFile && (
                  <button
                    type="button"
                    disabled={Boolean(scanningImage)}
                    onClick={() => handleScanPhoto(imgUrl)}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold rounded shadow-2xs transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {isScanningThis ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-emerald-200" />
                        <span>Scan MobileNetV2</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Upload Slot / Drag & Drop Target */}
        {images.length < MAX_IMAGES && (
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`aspect-square rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-all ${
              isDragging
                ? 'border-emerald-600 bg-emerald-50/50 scale-102'
                : 'border-slate-200 hover:border-emerald-600 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploadingCount > 0}
              className="hidden"
            />
            {uploadingCount > 0 ? (
              <div className="space-y-1.5">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <span className="text-[11px] font-bold text-slate-700 block">Uploading...</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 block">Add Photos</span>
                <span className="text-[10px] text-slate-400 block">
                  Drag & drop or browse ({images.length}/{MAX_IMAGES})
                </span>
              </div>
            )}
          </label>
        )}
      </div>

      {/* Inline MobileNetV2 Scan Result Card */}
      {scanResult && (
        <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <span className="font-extrabold text-emerald-950 block">
                  MobileNetV2 Visual Assessment Complete
                </span>
                <span className="text-[11px] text-emerald-800 block">
                  Predicted Condition:{' '}
                  <strong>{getConditionMeta(scanResult.condition).label}</strong> ({Math.round(scanResult.confidence * 100)}% Confidence)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyDetectedCondition}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Apply to Grade</span>
            </button>
          </div>

          <p className="text-[10.5px] text-emerald-900/80 leading-relaxed border-t border-emerald-200/60 pt-2">
            Advisory Notice: MobileNetV2 estimates physical exterior cosmetic wear based on visual markers. It does not verify internal hardware diagnostics or battery health. Seller confirmation is mandatory.
          </p>
        </div>
      )}
    </div>
  );
};
