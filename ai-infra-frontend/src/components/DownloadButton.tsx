import { Download } from 'lucide-react';
import { downloadMarkdown } from '../lib/api';

export const DownloadButton = ({ shortId }: { shortId: string }) => (
  <button
    type="button"
    onClick={() => downloadMarkdown(shortId)}
    className="flex h-10 w-10 items-center justify-center rounded-full border border-muted/30 bg-white/80 text-muted transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
    title="Download Markdown"
    aria-label="Download Markdown"
  >
    <Download className="h-4 w-4" />
  </button>
);
