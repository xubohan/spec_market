import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Menu, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Categories', to: '/categories' },
  { label: 'Tags', to: '/tags' },
  { label: 'Upload', to: '/upload' }
];

const NavContent = ({ close }: { close?: () => void }) => (
  <nav className="flex flex-col gap-2">
    {navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          `rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-primary/10 ${
            isActive ? 'bg-primary text-white' : 'text-muted'
          }`
        }
        onClick={close}
      >
        {item.label}
      </NavLink>
    ))}
  </nav>
);

export const SidebarNav = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="fixed left-4 top-4 z-50 rounded-lg bg-primary px-3 py-2 text-white shadow-md lg:hidden"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside className="fixed hidden h-full w-64 flex-col justify-between bg-background px-6 py-8 lg:flex">
        <div className="space-y-6">
          <div className="text-2xl font-bold tracking-tight">Spec.so</div>
          <NavContent />
        </div>
        <div className="text-sm text-muted">Settings (coming soon)</div>
      </aside>
      <Transition show={open} as={Fragment}>
        <Dialog onClose={() => setOpen(false)} className="relative z-50 lg:hidden">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="fixed inset-y-0 left-0 w-64 bg-background px-6 py-8 shadow-lg">
              <button
                className="mb-6 rounded-lg bg-primary px-3 py-2 text-white"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
              <NavContent close={() => setOpen(false)} />
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  );
};
