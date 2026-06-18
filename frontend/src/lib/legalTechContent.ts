export async function fetchLegalTechContent(): Promise<string> {
  const res = await fetch(`/static/legal-tech-tools.md?t=${Date.now()}`);
  return res.text();
}
