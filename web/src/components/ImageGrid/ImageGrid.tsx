import { useState } from "react";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentType, getAttachmentUrl, getAttachmentThumbnailUrl } from "@/utils/attachment";
import { cn } from "@/lib/utils";
import PreviewImageDialog from "../PreviewImageDialog";

interface ImageGridProps {
  attachments: Attachment[];
  className?: string;
}

/**
 * Weibo-style image grid layout
 * - 1 image: large single image
 * - 2-4 images: 2x2 grid
 * - 5-9 images: 3x3 grid
 * - 10+ images: 3x3 grid with last showing "+X"
 */
const ImageGrid = ({ attachments, className }: ImageGridProps) => {
  const [previewImage, setPreviewImage] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });

  // Filter only images
  const imageAttachments = attachments.filter((attachment) => getAttachmentType(attachment) === "image/*");
  
  if (imageAttachments.length === 0) {
    return null;
  }

  const imageUrls = imageAttachments.map((attachment) => getAttachmentUrl(attachment));
  const maxDisplay = 9;
  const displayCount = Math.min(imageAttachments.length, maxDisplay);
  const remainingCount = imageAttachments.length > maxDisplay ? imageAttachments.length - maxDisplay : 0;

  const handleImageClick = (index: number) => {
    setPreviewImage({ open: true, urls: imageUrls, index });
  };

  // Calculate grid layout
  const getGridClass = () => {
    if (displayCount === 1) {
      return "grid-cols-1";
    } else if (displayCount <= 4) {
      return "grid-cols-2";
    } else {
      return "grid-cols-3";
    }
  };

  const getImageClass = (index: number) => {
    if (displayCount === 1) {
      return "aspect-auto max-h-96";
    } else if (displayCount === 2) {
      return "aspect-square";
    } else if (displayCount === 3) {
      return "aspect-square";
    } else if (displayCount === 4) {
      return "aspect-square";
    } else {
      return "aspect-square";
    }
  };

  return (
    <>
      <div className={cn("w-full grid gap-1", getGridClass(), className)}>
        {imageAttachments.slice(0, displayCount).map((attachment, index) => {
          const isLast = index === displayCount - 1 && remainingCount > 0;
          const thumbnailUrl = getAttachmentThumbnailUrl(attachment);
          const attachmentUrl = getAttachmentUrl(attachment);

          return (
            <div
              key={attachment.name}
              className={cn(
                "relative overflow-hidden rounded-lg cursor-pointer group",
                getImageClass(index),
                displayCount === 1 ? "w-full" : "w-full"
              )}
              onClick={() => handleImageClick(index)}
            >
              <img
                src={thumbnailUrl}
                alt={attachment.filename}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes("?thumbnail=true")) {
                    target.src = attachmentUrl;
                  }
                }}
                decoding="async"
                loading="lazy"
              />
              {isLast && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold text-lg">
                  +{remainingCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <PreviewImageDialog
        open={previewImage.open}
        onOpenChange={(open) => setPreviewImage((prev) => ({ ...prev, open }))}
        imgUrls={previewImage.urls}
        initialIndex={previewImage.index}
      />
    </>
  );
};

export default ImageGrid;

