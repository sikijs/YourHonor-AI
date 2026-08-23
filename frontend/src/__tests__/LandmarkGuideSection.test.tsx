import { render, screen } from '@testing-library/react';

jest.mock('react-markdown', () => {
  const MockMarkdown = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  MockMarkdown.displayName = 'MockMarkdown';
  return MockMarkdown;
});
jest.mock('remark-gfm', () => ({}));

jest.mock('@/lib/landmarkGuideContent', () => ({
  fetchLandmarkGuide: jest.fn(),
}));

import LandmarkGuideSection from '@/components/LandmarkGuideSection';

const { fetchLandmarkGuide } = jest.requireMock('@/lib/landmarkGuideContent');

describe('LandmarkGuideSection', () => {
  beforeEach(() => {
    fetchLandmarkGuide.mockReset();
  });

  it('fetches and renders the guide on mount', async () => {
    fetchLandmarkGuide.mockResolvedValue(
      '# Landmark Cases Guide\n\n## Marbury v. Madison (1803)\n\n**In plain English:** judicial review.'
    );

    render(<LandmarkGuideSection />);

    expect(await screen.findByText(/judicial review\./)).toBeInTheDocument();
    expect(fetchLandmarkGuide).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state before the guide arrives', async () => {
    let resolveFetch: (value: string) => void = () => {};
    fetchLandmarkGuide.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<LandmarkGuideSection />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    resolveFetch('# Landmark Cases Guide');
    await screen.findByText(/Landmark Cases Guide/);
  });

  it('shows an error message when the fetch fails', async () => {
    fetchLandmarkGuide.mockRejectedValue(new Error('404'));

    render(<LandmarkGuideSection />);

    expect(await screen.findByText(/Could not load the guide/)).toBeInTheDocument();
  });
});
