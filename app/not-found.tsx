import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-gray-200 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-white mb-2">404</h1>
      <h2 className="text-lg text-gray-400 mb-6">Page Not Found</h2>
      <p className="text-sm text-gray-500 max-w-md mb-8">
        The reflection or page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
      >
        Return to Journal
      </Link>
    </div>
  );
}
