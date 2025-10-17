import { Link } from 'react-router-dom';
import { SpecSummary } from '../types/spec';
import { TagChip } from './TagChip';
import { buildSpecLink } from '../lib/api';

export const SpecCard = ({ spec }: { spec: SpecSummary }) => {
  return (
    <div className="flex flex-col justify-between rounded-2xl bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="space-y-3">
        <Link to={buildSpecLink(spec.shortId)} className="text-xl font-semibold hover:underline">
          {spec.title}
        </Link>
        <p className="text-sm text-muted">{spec.summary}</p>
        <div className="flex flex-wrap gap-2">
          {spec.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      </div>
      <div className="mt-4 text-xs text-muted">
        Updated {new Date(spec.updatedAt).toLocaleDateString()} · {spec.author}
      </div>
    </div>
  );
};
