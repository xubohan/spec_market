import { Download } from 'lucide-react';
import { downloadMarkdown } from '../lib/api';

export const DownloadButton = ({ shortId }: { shortId: string }) => (
  <button
    onClick={() => downloadMarkdown(shortId)}
    className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
  >
    <Download className="h-4 w-4" /> Download .md
  </button>
);
