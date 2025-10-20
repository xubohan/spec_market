import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router-dom';
import { Suspense } from 'react';
import { SidebarNav } from '../components/SidebarNav';
import { HomePage } from '../pages/Home';
import { CategoriesPage } from '../pages/Categories';
import { CategoryListPage } from '../pages/CategoryList';
import { TagsPage } from '../pages/Tags';
import { TagListPage } from '../pages/TagList';
import { SpecDetailPage } from '../pages/SpecDetail';
import { EditSpecPage } from '../pages/EditSpec';
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
          <main className="relative flex-1 px-6 py-10 lg:ml-64 lg:px-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-primary/15"
            />
            <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-10">
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
      { path: 'specs/:shortId/edit', element: <EditSpecPage /> },
      { path: 'upload', element: <UploadPage /> }
    ],
  },
]);
