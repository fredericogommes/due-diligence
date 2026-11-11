"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="text-brand underline"
      onClick={async () => {
        await navigator.clipboard?.writeText(text);
        setDone(true);
      }}
    >
      {done ? "copiado" : "copiar"}
    </button>
  );
}
