'use client';

import { useState, useEffect } from 'react';

export default function AppFooter() {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    up_to_date: boolean;
    latest_version: string;
  } | null>(null);

  const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.2.1';

  async function handleCheckUpdate(auto = false) {
    setChecking(true);
    try {
      const res = await fetch('/api/check-update');
      const data = await res.json();
      if (!auto || !data.up_to_date) {
        setUpdateInfo(data);
      }
    } catch {
      if (!auto) {
        setUpdateInfo({
          up_to_date: false,
          latest_version: 'unknown',
        });
      }
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const checked = sessionStorage.getItem('opencode-update-checked');
    if (!checked) {
      handleCheckUpdate(true);
      sessionStorage.setItem('opencode-update-checked', 'true');
    }
  }, []);

  return (
    <footer className="app-footer">
      <div className="app-footer-content">
        <span className="app-footer-version">YourHonor AI v{version}</span>
        <button
          className="app-footer-update-link"
          onClick={() => handleCheckUpdate()}
          disabled={checking}
        >
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>

      {updateInfo && !updateInfo.up_to_date && (
        <div className="update-banner">
          <div className="update-banner-content">
            <strong>Version {updateInfo.latest_version} is available</strong>
            <br />
            Close the app, then open <strong>Start YourHonor AI.command</strong> again. It
            will download the update automatically.
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
