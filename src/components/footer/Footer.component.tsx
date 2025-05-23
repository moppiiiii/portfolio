"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-8 border-t border-gray-800 bg-black">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Link href="#home" className="text-xl font-bold">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                Portfolio
              </span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
