"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface PhotoCaptureProps {
  photos: File[];
  onPhotosChange: (photos: File[]) => void;
  maxPhotos?: number;
  className?: string;
}

export function PhotoCapture({
  photos,
  onPhotosChange,
  maxPhotos = 5,
  className,
}: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newFiles = Array.from(files).slice(0, maxPhotos - photos.length);
      const updated = [...photos, ...newFiles];
      onPhotosChange(updated);

      // Generate previews
      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
      setPreviews((prev) => [...prev, ...newPreviews]);

      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [photos, onPhotosChange, maxPhotos]
  );

  const removePhoto = useCallback(
    (index: number) => {
      const updated = photos.filter((_, i) => i !== index);
      onPhotosChange(updated);

      // Revoke the old preview URL and remove it
      if (previews[index]) URL.revokeObjectURL(previews[index]);
      setPreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [photos, onPhotosChange, previews]
  );

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
        multiple
      />

      {/* Thumbnail previews */}
      {previews.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {previews.map((src, idx) => (
            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-lg p-0.5 opacity-0 group-hover:opacity-100 transition-opacity min-h-[28px] min-w-[28px] flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 min-h-[44px]"
        onClick={() => inputRef.current?.click()}
        disabled={photos.length >= maxPhotos}
      >
        <Camera className="h-4 w-4" />
        {photos.length > 0
          ? `${photos.length}/${maxPhotos} Photos`
          : "Take Photo"}
      </Button>
    </div>
  );
}
