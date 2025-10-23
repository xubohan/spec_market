import { Link } from 'react-router-dom';
import { Category } from '../types/spec';

export const CategoryBadge = ({ category }: { category: Category }) => (
  <Link
    to={`/categories/${category.slug}`}
    className="flex flex-col rounded-2xl bg-card p-5 shadow-sm transition hover:shadow-md"
  >
    <span className="text-lg font-semibold capitalize">{category.name}</span>
    <span className="text-sm text-muted">{category.count} specs</span>
  </Link>
);
