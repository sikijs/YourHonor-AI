'use client';

import { useState } from 'react';

export default function AppFooter() {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    up_to_date: boolean;
    latest_version: string;
    download_url: string;
  } | null>(null);

  const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.2.1';

  async function handleCheckUpdate() {
    setChecking(true);
    try {
      const res = await fetch('/api/check-update');
      const data = await res.json();
      setUpdateInfo(data);
    } catch {
      setUpdateInfo({
        up_to_date: false,
        latest_version: 'unknown',
        download_url: 'https://github.com/sikijs/YourHonor-AI/releases/latest',
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <footer className="app-footer">
      <div className="app-footer-content">
        <span className="app-footer-version">YourHonor AI v{version}</span>
        <button
          className="app-footer-update-link"
          onClick={handleCheckUpdate}
          disabled={checking}
        >
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>

      {updateInfo && !updateInfo.up_to_date && (
        <div className="update-banner">
          <div className="update-banner-content">
            <strong>Version {updateInfo.latest_version} is available</strong> &mdash;{' '}
            <a href={updateInfo.download_url} target="_blank" rel="noopener noreferrer">
              Download it from GitHub
            </a>.
            <br />
            <small>
              To upgrade: download the new version, unzip, and re-run setup.command to keep
              your settings.
            </small>
          </div>
          <button className="update-dismiss" onClick={() => setUpdateInfo(null)}>
            &times;
          </button>
        </div>
      )}

      {updateInfo?.up_to_date && (
        <div className="update-banner up-to-date">
          <span>YourHonor AI v{version} is up to date.</span>
          <button className="update-dismiss" onClick={() => setUpdateInfo(null)}>
            &times;
          </button>
        </div>
      )}
    </footer>
  );
}
