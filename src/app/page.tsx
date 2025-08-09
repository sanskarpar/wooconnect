"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-blue-200">
      {/* Hero Section */}
      <header className="flex flex-col items-center justify-center flex-1 py-16 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full flex flex-col items-center">
          <div className="w-20 h-20 mb-6 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-4xl font-bold">W</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-4 text-blue-700 text-center">
            WooConnect
          </h1>
          <p className="mb-8 text-lg text-gray-600 text-center">
            Seamlessly connect your WooCommerce store and manage your business with ease.<br />
            Automate, analyze, and grow—all in one place.
          </p>
          <div className="flex gap-4 w-full">
            <Link href="/login" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-center transition-colors shadow">
              Login
            </Link>
            <Link href="/signup" className="flex-1 bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold py-3 rounded-lg text-center transition-colors shadow">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="flex flex-col items-center py-12 px-4">
        <h2 className="text-2xl font-bold text-blue-700 mb-8">Why WooConnect?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <span className="text-blue-600 text-3xl mb-3">🔗</span>
            <h3 className="font-semibold text-lg mb-2">Easy Integration</h3>
            <p className="text-gray-500 text-center">Connect your WooCommerce store in minutes with our simple onboarding process.</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <span className="text-blue-600 text-3xl mb-3">📊</span>
            <h3 className="font-semibold text-lg mb-2">Powerful Analytics</h3>
            <p className="text-gray-500 text-center">Track sales, inventory, and customer trends with real-time dashboards.</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <span className="text-blue-600 text-3xl mb-3">⚡</span>
            <h3 className="font-semibold text-lg mb-2">Automation Tools</h3>
            <p className="text-gray-500 text-center">Automate order syncing, inventory updates, and notifications effortlessly.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} WooConnect. All rights reserved.
      </footer>
    </div>
  );
}
