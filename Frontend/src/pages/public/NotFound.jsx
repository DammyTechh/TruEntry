import BrandBackdrop from '../../components/ui/BrandBackdrop';
import { Button } from '../../components/ui/Primitives';

export default function NotFound() {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      <BrandBackdrop tone="light" />
      <div className="relative flex flex-col items-center">
      <div className="text-6xl font-extrabold text-primary">404</div>
      <h1 className="mt-2 text-xl font-semibold text-ink">Page not found</h1>
      <p className="mt-1 text-muted">The page you're looking for doesn't exist or has moved.</p>
      <Button to="/" className="mt-6">Back home</Button>
      </div>
    </div>
  );
}
