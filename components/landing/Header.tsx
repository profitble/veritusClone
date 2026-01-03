'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-[#f5f1e3]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 justify-between items-center">
          <div className="flex shrink-0 items-center min-w-0">
            <Image
              src="/assets/svgs/logo.svg"
              alt="Argon Labs Logo"
              width={200}
              height={40}
              className="h-8 w-auto max-w-full"
            />
          </div>
          
          <div className="hidden sm:flex sm:items-center">
            <a
              href="#"
              className="rounded-md border border-[#133333] px-4 py-2 text-sm font-medium text-[#133333] font-label flex items-center"
            >
              Log in
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setOpen(!open)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-600"
              aria-label="Toggle menu"
            >
              {open ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="sm:hidden">
          <div className="space-y-1 pb-3 pt-2 px-4">
            <a
              href="#"
              onClick={() => setOpen(false)}
              className="w-full text-center rounded-md border border-[#133333] py-2 text-sm font-medium text-[#133333] font-label flex items-center justify-center"
            >
              Log in
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}

