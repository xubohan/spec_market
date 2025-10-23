import { copyMarkdown } from '../lib/api';
import { useState } from 'react';
import { ClipboardCheck, ClipboardCopy } from 'lucide-react';
import clsx from 'clsx';

export const CopyMarkdownButton = ({ shortId }: { shortId: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyMarkdown(shortId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const label = copied ? 'Markdown copied' : 'Copy Markdown';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={clsx(
        'flex h-10 w-10 items-center justify-center rounded-full border bg-white/80 text-muted transition focus:outline-none focus:ring-2 focus:ring-primary/40',
        copied ? 'border-primary/50 text-primary' : 'border-muted/30 hover:border-primary/40 hover:text-primary'
      )}
      title={label}
      aria-label={label}
    >
      {copied ? <ClipboardCheck className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
    </button>
  );
};
