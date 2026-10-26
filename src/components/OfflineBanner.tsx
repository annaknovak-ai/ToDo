import { useOnlineStatus } from '../lib/useOnlineStatus';
import { messages } from '../messages';

// Shown under the navigation on both pages while there is no connection (ADR-10, ADR-22).
// Nothing is stored for offline use: data actions simply fail at the network request.
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="alert" data-testid="offline-banner">
      <p>{messages.offline}</p>
    </div>
  );
}
