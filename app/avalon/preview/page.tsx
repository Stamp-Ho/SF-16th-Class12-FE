import { notFound } from 'next/navigation';
import { AvalonPreview } from '../AvalonMain';

export default function AvalonPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AvalonPreview />;
}
