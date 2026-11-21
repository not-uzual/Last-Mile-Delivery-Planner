import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CalendarCheck, LinkIcon, MapPin, Package } from 'lucide-react';
import { createClient } from '@/lib/db/server';
import { formatDate } from '@/lib/dates';
import type { TimeSlot } from '@/lib/slots';
import { Logo } from '@/components/Logo';
import { Card, Skeleton } from '@/components/ui';
import SlotPicker from './slot-picker';

export const metadata: Metadata = { title: 'Choose your delivery time', robots: { index: false } };

type Booking = {
  customer_name: string;
  address: string;
  scheduled_date: string;
  time_slot: TimeSlot | null;
  status: 'scheduled' | 'delivered' | 'failed';
  items: string[];
  taken: Partial<Record<TimeSlot, number>>;
};

export default function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <BookingContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function BookingContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_booking', { p_token: token });
  const booking = data as Booking | null;

  if (!booking) {
    return (
      <Card className="p-8 text-center">
        <LinkIcon className="mx-auto size-8 text-zinc-300" />
        <h1 className="mt-4 text-lg font-semibold">This link isn’t valid</h1>
        <p className="mt-1 text-sm text-zinc-500">It may have expired or the delivery was changed. Please contact us and we’ll send a new one.</p>
      </Card>
    );
  }

  const firstName = booking.customer_name.replace(/^(Mr\.|Mrs\.|Ms\.|Miss|Dr\.)\s+/, '').split(' ')[0];
  const dateLabel = formatDate(booking.scheduled_date, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-zinc-500">Hi {firstName},</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose a delivery time</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
          <CalendarCheck className="size-4 text-brand-600" /> Your furniture arrives on <span className="font-semibold">{dateLabel}</span>
        </p>
      </div>

      <Card className="divide-y divide-zinc-100">
        <p className="flex items-start gap-2 px-4 py-3 text-sm text-zinc-700">
          <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" /> {booking.address}
        </p>
        <ul className="px-4 py-3 text-sm text-zinc-700">
          {booking.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 py-0.5">
              <Package className="size-4 shrink-0 text-zinc-400" /> {item}
            </li>
          ))}
        </ul>
      </Card>

      <SlotPicker token={token} current={booking.time_slot} taken={booking.taken} status={booking.status} scheduledDate={booking.scheduled_date} />

      <p className="text-center text-xs text-zinc-400">Our team will call you the day before to reconfirm. Assembly is included.</p>
    </div>
  );
}
