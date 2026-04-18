type ChatDebugPanelProps = {
  payloadMeasure: {
    previewChars: number;
    detailChars: number;
    largestPreviewChars: number;
  };
  openDurationMs: number | null;
  initialRenderMs: number | null;
  createDurationMs: number | null;
  sendDurationMs: number | null;
  assistantRenderMs: number | null;
  threadStateLabel: string;
  renderCount: number;
};

export function ChatDebugPanel({
  payloadMeasure,
  openDurationMs,
  initialRenderMs,
  createDurationMs,
  sendDurationMs,
  assistantRenderMs,
  threadStateLabel,
  renderCount,
}: ChatDebugPanelProps) {
  const rows = [
    ["Payload preview", `${payloadMeasure.previewChars.toLocaleString("fr-FR")} chars`],
    ["Payload detail", `${payloadMeasure.detailChars.toLocaleString("fr-FR")} chars`],
    ["Plus gros preview", `${payloadMeasure.largestPreviewChars.toLocaleString("fr-FR")} chars`],
    ["Ouverture", openDurationMs != null ? `${Math.round(openDurationMs)} ms` : "-"],
    ["Rendu initial", initialRenderMs != null ? `${Math.round(initialRenderMs)} ms` : "-"],
    ["Creation", createDurationMs != null ? `${Math.round(createDurationMs)} ms` : "-"],
    ["Envoi", sendDurationMs != null ? `${Math.round(sendDurationMs)} ms` : "-"],
    ["Rendu assistant", assistantRenderMs != null ? `${Math.round(assistantRenderMs)} ms` : "-"],
    ["Pagination", threadStateLabel],
    ["Rerenders thread", `${renderCount}`],
  ];

  return (
    <aside className="hidden xl:block xl:w-[290px]">
      <div className="chat-sidebar-panel">
        <p className="chat-sidebar-eyebrow">Debug</p>
        <h2 className="chat-sidebar-title">Performance conversationnelle</h2>
        <div className="mt-5 space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="chat-debug-row">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
