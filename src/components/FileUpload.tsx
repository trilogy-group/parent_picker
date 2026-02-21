"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Image, Video } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  userId?: string | null;
}

const ACCEPTED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "video/mp4", "video/quicktime",
  "application/pdf",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
  if (type.startsWith("video/")) return <Video className="w-4 h-4 text-purple-500" />;
  return <FileText className="w-4 h-4 text-gray-500" />;
}

export function FileUpload({ onFilesChange, userId }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      setError("Sign in to upload files");
      return;
    }

    const toUpload = Array.from(fileList).filter((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`${f.name}: unsupported file type`);
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`${f.name}: exceeds 50MB limit`);
        return false;
      }
      return true;
    });

    if (toUpload.length === 0) return;

    setUploading(true);
    setError(null);

    const newFiles: UploadedFile[] = [];

    for (const file of toUpload) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("location-attachments")
        .upload(path, file);

      if (uploadError) {
        setError(`Failed to upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("location-attachments")
        .getPublicUrl(path);

      newFiles.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    const updated = [...files, ...newFiles];
    setFiles(updated);
    onFilesChange(updated);
    setUploading(false);
  }, [files, onFilesChange, userId]);

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesChange(updated);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [uploadFiles]);

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        data-testid="file-upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center text-sm cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? "text-blue-500" : "text-gray-400"}`} />
        <p className="font-medium text-foreground mb-1">Floorplan, photos, or video</p>
        <p className="text-muted-foreground">
          {uploading ? "Uploading..." : "Drag & drop files here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Images, video, or PDF up to 50MB each
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            uploadFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* Error */}
      {error && (
        <p data-testid="upload-error" className="text-xs text-red-600">{error}</p>
      )}

      {/* Uploaded file list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2 text-sm">
              <FileIcon type={file.type} />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
