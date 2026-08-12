import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionBar from '@/components/ActionBar';

jest.mock('@/lib/export', () => {
  const actual = jest.requireActual('@/lib/export');
  return {
    ...actual,
    downloadExport: jest.fn(),
  };
});

const { downloadExport: mockedDownloadExport } = jest.requireMock('@/lib/export');

describe('ActionBar', () => {
  beforeEach(() => {
    mockedDownloadExport.mockReset();
  });

  it('renders no export buttons without content', () => {
    render(
      <ActionBar
        saved={false}
        copied={false}
        onCopy={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download DOCX' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download MD' })).not.toBeInTheDocument();
  });

  it('downloads PDF with html content type', async () => {
    const user = userEvent.setup();
    render(
      <ActionBar
        saved={false}
        copied={false}
        onCopy={() => {}}
        content="<p>hi</p>"
        filename="brief"
        contentType="html"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(mockedDownloadExport).toHaveBeenCalledWith('<p>hi</p>', 'brief', 'pdf', 'html'));
  });

  it('downloads DOCX with default markdown content type', async () => {
    const user = userEvent.setup();
    render(
      <ActionBar
        saved={false}
        copied={false}
        onCopy={() => {}}
        content="# Title"
        filename="memo"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download DOCX' }));
    await waitFor(() => expect(mockedDownloadExport).toHaveBeenCalledWith('# Title', 'memo', 'docx', 'markdown'));
  });

  it('downloads MD using the passed content type', async () => {
    const user = userEvent.setup();
    render(
      <ActionBar
        saved={false}
        copied={false}
        onCopy={() => {}}
        content="<h2>Issues</h2>"
        filename="brief"
        contentType="html"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download MD' }));
    await waitFor(() => expect(mockedDownloadExport).toHaveBeenCalledWith('<h2>Issues</h2>', 'brief', 'md', 'html'));
  });

  it('props export errors to onExportError', async () => {
    const user = userEvent.setup();
    const onError = jest.fn();
    mockedDownloadExport.mockRejectedValue(new Error('Export failed'));
    render(
      <ActionBar
        saved={false}
        copied={false}
        onCopy={() => {}}
        content="x"
        filename="y"
        onExportError={onError}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Export failed'));
  });

  it('shows Copy to Clipboard and all three download buttons', () => {
    render(
      <ActionBar
        saved={false}
        copied={false}
        onCopy={() => {}}
        content="x"
        filename="y"
      />
    );
    expect(screen.getByRole('button', { name: 'Copy to Clipboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save PDF' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download MD' })).toBeInTheDocument();
  });
});