export async function readResumeFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a resume under 5 MB.');
  let text = '';
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 15) throw new Error('Choose a resume of 15 pages or fewer.');
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text +=
          content.items
            .map((item) =>
              'str' in item ? item.str + ('hasEOL' in item && item.hasEOL ? '\n' : ' ') : '',
            )
            .join('') + '\n';
      }
    } finally {
      await task.destroy();
    }
  } else if (/\.(txt|md)$/i.test(file.name)) text = await file.text();
  else throw new Error('Upload a PDF, TXT, or Markdown resume.');
  if (text.trim().length < 20)
    throw new Error('No readable text found. For scanned PDFs, paste your resume text instead.');
  if (text.length > 30000)
    throw new Error('Resume text exceeds 30,000 characters. Paste a shorter version.');
  return text;
}
