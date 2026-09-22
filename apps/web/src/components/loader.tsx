export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <span
        role="status"
        aria-label="Loading"
        className="size-6 animate-spin rounded-full border-2 border-diploma/26 border-t-burdell"
      />
    </div>
  );
}
