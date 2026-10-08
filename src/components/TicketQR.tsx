"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function TicketQR({ code }: { code: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    QRCode.toDataURL(code, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setSrc);
  }, [code]);

  if (!src) return <div className="h-[200px] w-[200px] animate-pulse rounded-xl bg-surface-2" />;

  return (
    <div className="inline-block rounded-xl bg-white p-3">
      <img src={src} alt={`QR ${code}`} width={200} height={200} />
    </div>
  );
}
