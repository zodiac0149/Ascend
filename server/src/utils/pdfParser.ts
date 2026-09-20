import pdfParse from 'pdf-parse';

/**
 * Extracts clean plain text from a PDF buffer.
 * Strips excessive whitespace and normalises line breaks for LLM ingestion.
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer, {
      // Limit to first 50 pages for performance
      max: 50,
    });

    const rawText = data.text;

    // Normalise whitespace: collapse multiple newlines/spaces
    const cleaned = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    if (!cleaned || cleaned.length < 50) {
      throw new Error('Extracted text is too short — the PDF may be image-based or corrupted.');
    }

    return cleaned;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Failed to parse PDF file.');
  }
}

/**
 * Returns a truncated version of resume text safe for LLM context windows.
 * AWS Nova Pro supports ~300K tokens; we cap at ~12,000 chars (~3,000 tokens).
 */
export function truncateResumeText(text: string, maxChars = 12_000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[Resume truncated for processing...]';
}
