import Image from "next/image";
import Link from "next/link";
import { FaXTwitter } from "react-icons/fa6";
import { SlSocialLinkedin } from "react-icons/sl";

export default function Footer() {
  return (
    <footer className="bg-[#f5f1e3] py-16" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex justify-center items-center mb-16 w-full">
          <Image
            src="/assets/svgs/logo.svg"
            alt="Argon Labs Logo"
            width={400}
            height={76}
            className="h-20 w-auto max-w-full mx-auto"
          />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-4 border-t border-gray-900/10 pt-8">
          <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6 md:gap-8">
            <p className="font-label text-sm leading-5 text-gray-500 text-center md:text-left">
              Copyright &copy; 2025 Argon Labs, Inc
            </p>
            <div className="flex gap-4">
              <Link href="#" className="text-gray-400">
                <span className="sr-only">LinkedIn</span>
                <SlSocialLinkedin className="h-5 w-5 text-[#0D3B42]" />
              </Link>
              <Link href="#" className="text-gray-400">
                <span className="sr-only">X (Twitter)</span>
                <FaXTwitter className="h-5 w-5 text-[#0D3B42]" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-center sm:text-left">
            <Link
              href="#"
              className="font-label text-sm text-[#0D3B42]"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="font-label text-sm text-[#0D3B42]"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
