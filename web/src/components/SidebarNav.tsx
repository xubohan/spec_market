import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Menu, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const navSections = [
  {
    title: 'Navigation',
    items: [
      { label: 'Home', to: '/' },
      { label: 'Categories', to: '/categories' },
      { label: 'Tags', to: '/tags' },
    ],
  },
  {
    title: 'Workspace',
    items: [{ label: 'New Spec', to: '/upload' }],
  },
];

const NavItem = ({
  item,
  close,
}: {
  item: { label: string; to: string };
  close?: () => void;
}) => (
  <NavLink
    key={item.to}
    to={item.to}
    className={({ isActive }) =>
      clsx(
        'group relative flex items-center rounded-xl border border-transparent px-5 py-3 text-sm font-semibold transition-all',
        isActive
          ? 'border-primary/40 bg-primary/10 text-text shadow-[0_6px_18px_rgba(227,101,73,0.15)]'
          : 'text-muted hover:border-primary/30 hover:bg-primary/5 hover:text-text hover:shadow-[0_4px_12px_rgba(227,101,73,0.1)]'
      )
    }
    onClick={close}
  >
    {({ isActive }) => (
      <>
        <span
          className={clsx(
            'absolute left-2 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition-all',
            isActive ? 'bg-primary opacity-100 shadow-[0_0_6px_rgba(227,101,73,0.5)]' : 'bg-primary/40 opacity-0 group-hover:opacity-60'
          )}
          aria-hidden
        />
        <span className="pl-3">{item.label}</span>
      </>
    )}
  </NavLink>
);

const NavContent = ({ close }: { close?: () => void }) => (
  <nav className="flex flex-col gap-6">
    {navSections.map((section) => (
      <div key={section.title} className="space-y-2">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted/70">
          {section.title}
        </p>
        <div className="flex flex-col gap-2">
          {section.items.map((item) => (
            <NavItem key={item.to} item={item} close={close} />
          ))}
        </div>
      </div>
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
      <aside className="fixed hidden h-full w-64 flex-col justify-between bg-[#FBFAF8] px-6 py-8 shadow-[inset_-1px_0_0_rgba(0,0,0,0.05)] lg:flex">
        <div className="space-y-6">
          <div
            className="text-2xl font-semibold tracking-tight text-text"
            style={{ fontFamily: "'Space Grotesk', 'Inter', 'Noto Sans SC', system-ui, sans-serif", letterSpacing: '-0.01em' }}
          >
            <span className="text-text">Spec</span>
            <span className="text-primary">.so</span>
          </div>
          <NavContent />
        </div>
        <div className="text-sm font-medium text-muted/60">Settings (coming soon)</div>
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
