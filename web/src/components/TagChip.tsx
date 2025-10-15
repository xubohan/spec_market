import { Link } from 'react-router-dom';

export const TagChip = ({ tag }: { tag: string }) => (
  <Link
    to={`/tags/${tag}`}
    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
  >
    #{tag}
  </Link>
);
