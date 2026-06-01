export async function fetchLegalTechContent(): Promise<string> {
  const res = await fetch('/static/legal-tech-tools.md');
  return res.text();
}
