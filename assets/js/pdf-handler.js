/**
 * PDF Handler
 * Manages PDF loading, text extraction, and rendering
 */

export class PDFHandler {
  constructor() {
    this.pdfDocument = null;
    this.currentPage = 1;
    this.pdfText = "";
    this.fullDocumentText = "";
    this.currentProcessingId = 0;
  }

  /**
   * Load and process PDF file with enhanced text extraction
   */
  async loadPDF(file, progressCallback, statusCallback) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = async (loadEvent) => {
        try {
          statusCallback("Reading PDF file...");
          const typedarray = new Uint8Array(loadEvent.target.result);

          // Configure PDF.js for better text extraction
          const pdf = await pdfjsLib.getDocument({
            data: typedarray,
            useSystemFonts: true,
            standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/standard_fonts/",
          }).promise;

          // Store pdf document for rendering
          this.pdfDocument = pdf;
          this.currentPage = 1;

          // Create a cancelable processing token for this upload
          this.currentProcessingId += 1;
          const thisProcessingId = this.currentProcessingId;

          // Reset cached state for a new document
          this.pdfText = "";
          this.fullDocumentText = "";

          statusCallback(`Processing ${pdf.numPages} pages...`);

          // Extract text from all pages efficiently (batch processing)
          const textPromises = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            textPromises.push(pdf.getPage(i).then((page) => page.getTextContent()));
          }

          // Process all pages in parallel for speed
          const allTextContents = await Promise.all(textPromises);

          // Now build the text from all pages
          for (let i = 0; i < allTextContents.length; i++) {
            // Check if processing was cancelled
            if (thisProcessingId !== this.currentProcessingId) {
              statusCallback("Processing cancelled.");
              reject(new Error("Processing cancelled"));
              return;
            }

            // Update progress frequently
            const percent = Math.round(((i + 1) / pdf.numPages) * 100);
            progressCallback(percent);

            if (i % 3 === 0) {
              // Update status every 3 pages to reduce UI updates
              statusCallback(`Extracting text: ${i + 1}/${pdf.numPages} pages...`);
            }

            try {
              const textContent = allTextContents[i];

              // Simple and fast text extraction
              const pageText = textContent.items
                .map((item) => item.str)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

              if (pageText.length > 0) {
                this.pdfText += pageText + " ";
                this.fullDocumentText += pageText + " ";
              }
            } catch (pageError) {
              console.warn(`Error processing page ${i + 1}:`, pageError);
              // Continue with other pages
            }
          }

          if (thisProcessingId === this.currentProcessingId) {
            // Final cleanup of extracted text
            this.pdfText = this.pdfText.replace(/\s+/g, " ").trim();
            this.fullDocumentText = this.fullDocumentText.replace(/\s+/g, " ").trim();

            const textStats = {
              pages: pdf.numPages,
              characters: this.pdfText.length,
              words: this.pdfText.split(/\s+/).filter((w) => w.length > 0).length,
            };

            statusCallback(
              `✅ PDF Ready! ${textStats.pages} pages • ${textStats.characters} characters • ${textStats.words} words`
            );
            console.log("✅ PDF extraction complete:", textStats);
            console.log("📝 Sample text:", this.pdfText.substring(0, 200) + "...");

            if (this.pdfText.length < 100) {
              console.warn("Warning: Very little text extracted. PDF might be image-based or encrypted.");
              statusCallback("⚠️ Warning: Limited text found. PDF may contain mostly images.");
            }

            resolve(pdf);
          }
        } catch (error) {
          console.error("PDF loading error:", error);
          reject(new Error(`Failed to load PDF: ${error.message}`));
        }
      };

      fileReader.onerror = () => {
        reject(new Error("Error reading file"));
      };

      fileReader.readAsArrayBuffer(file);
    });
  }

  /**
   * Render a specific page of the PDF
   */
  async renderPage(pageNum) {
    if (!this.pdfDocument) return;

    try {
      const page = await this.pdfDocument.getPage(pageNum);

      // Use a larger base scale for better viewing
      const baseScale = 2.0;
      const viewport = page.getViewport({ scale: baseScale });

      const canvas = document.getElementById("pdf-canvas");
      const context = canvas.getContext("2d");

      // Use high-DPI rendering for crisp display
      const outputScale = window.devicePixelRatio || 1;

      // Set canvas internal dimensions
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);

      // Remove CSS width/height to maintain aspect ratio
      canvas.style.width = "";
      canvas.style.height = "";
      canvas.style.maxWidth = "100%";
      canvas.style.maxHeight = "100%";

      // Scale the drawing context for HiDPI displays
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      document.getElementById("page-num").textContent = `Page ${pageNum} / ${this.pdfDocument.numPages}`;
      this.currentPage = pageNum;

      return {
        currentPage: pageNum,
        totalPages: this.pdfDocument.numPages,
      };
    } catch (e) {
      console.error("renderPage error", e);
      throw e;
    }
  }

  /**
   * Get relevant context from cached text using keyword matching
   */
  getRelevantContext(question, maxChars = 3000) {
    if (!this.pdfText) return "";

    // Extract keywords from question
    const keywords = question
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            "what",
            "where",
            "when",
            "which",
            "whom",
            "whose",
            "this",
            "that",
            "these",
            "those",
            "from",
            "with",
            "about",
          ].includes(word)
      );

    if (keywords.length === 0) {
      return this.pdfText.slice(0, maxChars);
    }

    // Split text into chunks and score them
    const chunkSize = 500;
    const chunks = [];
    for (let i = 0; i < this.pdfText.length; i += chunkSize) {
      chunks.push({
        text: this.pdfText.slice(i, i + chunkSize),
        startPos: i,
      });
    }

    // Score each chunk based on keyword matches
    const scoredChunks = chunks.map((chunk) => {
      const lowerText = chunk.text.toLowerCase();
      let score = 0;

      for (const keyword of keywords) {
        const regex = new RegExp(keyword, "gi");
        const matches = lowerText.match(regex);
        if (matches) {
          score += matches.length * 2;
        }
      }

      return { ...chunk, score };
    });

    // Sort by score and get top chunks
    scoredChunks.sort((a, b) => b.score - a.score);

    if (scoredChunks[0].score > 0) {
      let context = "";
      for (let i = 0; i < Math.min(3, scoredChunks.length); i++) {
        if (scoredChunks[i].score > 0) {
          context += scoredChunks[i].text + "\n\n";
        }
        if (context.length >= maxChars) break;
      }
      return context.slice(0, maxChars);
    }

    return this.pdfText.slice(0, maxChars);
  }

  /**
   * Get text for summarization - processes ENTIRE PDF
   */
  getTextChunks(chunkSize = 1200, maxChunks = null) {
    const chunks = [];
    // If maxChunks is null, process ENTIRE document
    const limit = maxChunks || Math.ceil(this.pdfText.length / chunkSize);

    for (let i = 0; i < this.pdfText.length && chunks.length < limit; i += chunkSize) {
      const chunk = this.pdfText.slice(i, i + chunkSize).trim();
      if (chunk.length > 50) {
        // Only add meaningful chunks
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  /**
   * Get text segments for quiz generation
   */
  getTextSegments() {
    const segments = [];
    const segmentSize = 800;
    const step = Math.floor(this.pdfText.length / 4);

    for (let i = 0; i < this.pdfText.length && segments.length < 3; i += step) {
      segments.push(this.pdfText.slice(i, i + segmentSize));
    }

    return segments;
  }

  /**
   * Get meaningful sentences for quiz questions
   */
  getMeaningfulSentences(text, count = 3) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences
      .map((s) => s.trim())
      .filter((s) => s.length > 50 && s.length < 200)
      .slice(0, count);
  }

  /**
   * Check if PDF is loaded
   */
  isLoaded() {
    return this.pdfDocument !== null && this.pdfText.length > 0;
  }

  /**
   * Get PDF info
   */
  getInfo() {
    if (!this.pdfDocument) return null;
    return {
      numPages: this.pdfDocument.numPages,
      currentPage: this.currentPage,
      textLength: this.pdfText.length,
    };
  }
}
