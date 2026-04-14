"use client";

import { useEffect, useState } from "react";

export function useProductImages() {
  const [imgMap, setImgMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/data/prdt_img_map.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((map: Record<string, string>) => setImgMap(map))
      .catch(() => {});
  }, []);

  return imgMap;
}
