"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type StoreImageProps = {
  src: string;
  alt: string;
  className: string;
  sizes: string;
  priority?: boolean;
  children?: ReactNode;
};

export default function StoreImage({ src, alt, className, sizes, priority = false, children }: StoreImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`${className} store-image${failed ? " has-failed" : ""}`}>
      {!failed && <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        unoptimized={src.startsWith(`${process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000"}/`)}
        loading={priority ? "eager" : "lazy"}
        onError={() => setFailed(true)}
      />}
      {failed && <span className="store-image-fallback">Image indisponible</span>}
      {children}
    </span>
  );
}
