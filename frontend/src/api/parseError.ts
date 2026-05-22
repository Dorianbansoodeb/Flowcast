export function parseApiError(text: string, status: number): string {
  try {
    const json = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof json.detail === "string") {
      return json.detail;
    }
    if (Array.isArray(json.detail)) {
      return json.detail.map((d) => d.msg ?? String(d)).join("; ");
    }
  } catch {
    /* plain text */
  }
  if (text && text.length < 200) {
    return text;
  }
  return `Request failed (${status})`;
}
