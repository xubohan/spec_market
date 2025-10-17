import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router-dom';
import { Suspense } from 'react';
import { SidebarNav } from '../components/SidebarNav';
import { HomePage } from '../pages/Home';
import { CategoriesPage } from '../pages/Categories';
import { CategoryListPage } from '../pages/CategoryList';
import { TagsPage } from '../pages/Tags';
import { TagListPage } from '../pages/TagList';
import { SpecDetailPage } from '../pages/SpecDetail';
import { UploadPage } from '../pages/Upload';
import { AdminTokenProvider } from '../lib/auth';
import { HeaderBar } from '../components/HeaderBar';

function AppLayout() {
  return (
    <AdminTokenProvider>
      <div className="min-h-screen bg-background text-text">
        <ScrollRestoration />
        <div className="flex min-h-screen">
          <SidebarNav />
          <main className="flex-1 px-8 py-6 lg:ml-64">
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
              <HeaderBar />
              <Suspense fallback={<div>Loading...</div>}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </AdminTokenProvider>
  );
}

function ErrorState() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="rounded-2xl bg-card p-8 shadow-md">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted">Please refresh the page.</p>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorState />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'categories/:slug', element: <CategoryListPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'tags/:slug', element: <TagListPage /> },
      { path: 'specs/:shortId', element: <SpecDetailPage /> },
      { path: 'upload', element: <UploadPage /> }
    ],
  },
]);
