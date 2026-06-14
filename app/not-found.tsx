import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">404</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          We couldn&apos;t find that page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
