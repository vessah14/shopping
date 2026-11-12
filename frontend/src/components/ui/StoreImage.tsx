"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type StoreImageProps = {
  src: string;
  alt: string;
  className: string;
  sizes: string;
  priority?: boolean;
  objectPosition?: string;
  children?: ReactNode;
};

export default function StoreImage({ src, alt, className, sizes, priority = false, objectPosition, children }: StoreImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <span className={`${className} store-image${loaded ? " is-loaded" : ""}${failed ? " has-failed" : ""}`}>
      {!failed && <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        style={{ objectPosition }}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />}
      {failed && <span className="store-image-fallback">Image indisponible</span>}
      {children}
    </span>
  );
}
