import { act, render, screen } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';
import { messages } from '../messages';

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

describe('OfflineBanner', () => {
  it('is hidden while online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('appears when the connection drops and disappears when it returns', () => {
    render(<OfflineBanner />);
    setOnline(false);
    expect(screen.getByRole('alert')).toHaveTextContent(messages.offline);
    setOnline(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
