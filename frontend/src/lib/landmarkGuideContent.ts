// Fetches the Landmark Cases Guide markdown served from /static.
// The canonical copy lives in docs/landmark-cases.md; frontend/public holds
// the app copy that the build ships into backend/app/static (see
// scripts/sync-frontend.sh and the NOTES.md "Data Locations" section).
export async function fetchLandmarkGuide(): Promise<string> {
  const res = await fetch(`/static/landmark-cases.md?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Failed to load guide (${res.status})`);
  }
  return res.text();
}
