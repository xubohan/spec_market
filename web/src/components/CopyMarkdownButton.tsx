import { copyMarkdown } from '../lib/api';
import { useState } from 'react';
import { ClipboardCheck, ClipboardCopy } from 'lucide-react';

export const CopyMarkdownButton = ({ slug }: { slug: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyMarkdown(slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
    >
      {copied ? <ClipboardCheck className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
      {copied ? 'Copied' : 'Copy Markdown'}
    </button>
  );
};
