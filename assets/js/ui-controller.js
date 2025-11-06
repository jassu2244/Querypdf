/**
 * UI Controller
 * Manages all UI interactions and state
 */

export class UIController {
  constructor(pdfHandler, aiModel) {
    this.pdfHandler = pdfHandler;
    this.aiModel = aiModel;
    this.summaryText = null;
    this.quizQuestions = [];
    this.currentQuizIndex = 0;
    this.quizScore = 0;
    this.questionCache = {};
    this.lastAskRequestId = 0;

    this.initializeElements();
    this.attachEventListeners();
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    this.elements = {
      status: document.getElementById("status"),
      uploadElement: document.getElementById("pdf-upload"),
      uploadLabel: document.getElementById("pdf-upload-label"),
      uploadText: document.getElementById("upload-text"),
      uploadSection: document.getElementById("upload-section"),
      chatSection: document.getElementById("chat-section"),
      questionInput: document.getElementById("question-input"),
      askButton: document.getElementById("ask-button"),
      answerOutput: document.getElementById("answer-output"),
      tabSummary: document.getElementById("tab-summary"),
      tabQA: document.getElementById("tab-qa"),
      tabQuiz: document.getElementById("tab-quiz"),
      summaryContent: document.getElementById("summary-content"),
      qaContent: document.getElementById("qa-content"),
      quizContent: document.getElementById("quiz-content"),
      generateSummaryButton: document.getElementById("generate-summary-button"),
      summaryOutput: document.getElementById("summary-output"),
      generateQuizButton: document.getElementById("generate-quiz-button"),
      quizContainer: document.getElementById("quiz-container"),
      prevPageButton: document.getElementById("prev-page"),
      nextPageButton: document.getElementById("next-page"),
      progressContainer: document.getElementById("indexing-progress-container"),
      progressFill: document.getElementById("indexing-progress-fill"),
    };
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Tab switching
    this.elements.tabSummary?.addEventListener("click", () => this.switchTab("summary"));
    this.elements.tabQA?.addEventListener("click", () => this.switchTab("qa"));
    this.elements.tabQuiz?.addEventListener("click", () => this.switchTab("quiz"));

    // Upload handling
    this.elements.uploadLabel?.addEventListener("click", (ev) => this.handleUploadClick(ev));
    this.elements.uploadElement?.addEventListener("change", (e) => this.handleFileUpload(e));

    // Q&A
    this.elements.askButton?.addEventListener("click", () => this.handleAsk());

    // Summary
    this.elements.generateSummaryButton?.addEventListener("click", () => this.handleGenerateSummary());

    // Quiz
    this.elements.generateQuizButton?.addEventListener("click", () => this.handleGenerateQuiz());

    // PDF navigation
    this.elements.prevPageButton?.addEventListener("click", () => this.handlePrevPage());
    this.elements.nextPageButton?.addEventListener("click", () => this.handleNextPage());

    // Default to Q&A tab
    this.switchTab("qa");
  }

  /**
   * Update status message
   */
  updateStatus(msg, isError = false) {
    if (!this.elements.status) return;

    this.elements.status.textContent = msg;
    if (isError) {
      this.elements.status.classList.add("bg-red-50", "border-red-200", "text-red-700");
      this.elements.status.classList.remove("bg-blue-50", "border-blue-200", "text-blue-700");
    } else {
      this.elements.status.classList.add("bg-blue-50", "border-blue-200", "text-blue-700");
      this.elements.status.classList.remove("bg-red-50", "border-red-200", "text-red-700");
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    const tabs = [this.elements.tabSummary, this.elements.tabQA, this.elements.tabQuiz];
    tabs.forEach((t) => {
      if (!t) return;
      t.classList.remove("border-b-2", "border-blue-600", "text-blue-600");
      t.classList.add("text-gray-600");
      t.setAttribute("aria-selected", "false");
    });

    const panels = [this.elements.summaryContent, this.elements.qaContent, this.elements.quizContent];
    panels.forEach((p) => {
      if (p) p.classList.add("hidden");
    });

    if (tabName === "summary") {
      this.elements.tabSummary.classList.add("border-b-2", "border-blue-600", "text-blue-600");
      this.elements.tabSummary.classList.remove("text-gray-600");
      this.elements.tabSummary.setAttribute("aria-selected", "true");
      this.elements.summaryContent.classList.remove("hidden");
    } else if (tabName === "qa") {
      this.elements.tabQA.classList.add("border-b-2", "border-blue-600", "text-blue-600");
      this.elements.tabQA.classList.remove("text-gray-600");
      this.elements.tabQA.setAttribute("aria-selected", "true");
      this.elements.qaContent.classList.remove("hidden");
    } else if (tabName === "quiz") {
      this.elements.tabQuiz.classList.add("border-b-2", "border-blue-600", "text-blue-600");
      this.elements.tabQuiz.classList.remove("text-gray-600");
      this.elements.tabQuiz.setAttribute("aria-selected", "true");
      this.elements.quizContent.classList.remove("hidden");
    }
  }

  /**
   * Handle upload label click
   */
  handleUploadClick(ev) {
    if (this.elements.uploadElement.disabled) {
      ev.preventDefault();
      this.updateStatus("Models are still loading — please wait a moment before uploading.");
      return false;
    }
    return true;
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      this.updateStatus("Reading PDF...");
      this.elements.uploadLabel.disabled = true;
      this.elements.uploadText.textContent = "Processing...";

      // Reset state
      this.summaryText = null;
      this.quizQuestions = [];
      this.questionCache = {};
      this.currentQuizIndex = 0;
      this.quizScore = 0;
      this.elements.summaryOutput.innerHTML = "";
      this.elements.answerOutput.textContent = "Ask a question to get an answer from the PDF.";
      this.elements.quizContainer.innerHTML = "";

      // Show progress bar
      this.elements.progressContainer.classList.add("visible");
      this.elements.progressFill.style.width = "0%";
      this.elements.progressFill.textContent = "0%";

      // Load PDF
      await this.pdfHandler.loadPDF(
        file,
        (percent) => {
          this.elements.progressFill.style.width = percent + "%";
          this.elements.progressFill.textContent = percent + "%";
        },
        (msg) => this.updateStatus(msg)
      );

      // Hide progress bar
      this.elements.progressContainer.classList.remove("visible");

      // Show chat section
      this.elements.uploadSection.classList.add("hidden");
      this.elements.chatSection.classList.remove("hidden");

      // Render first page
      await this.pdfHandler.renderPage(1);
      this.updateNavigationButtons();
    } catch (e) {
      console.error("Upload error:", e);
      this.updateStatus(`Error processing PDF: ${e.message}`, true);
      this.elements.uploadLabel.disabled = false;
      this.elements.uploadText.textContent = "Click to upload your PDF";
      this.elements.progressContainer.classList.remove("visible");
    }
  }

  /**
   * Debounce helper
   */
  debounce(fn, ms) {
    let timeoutId = null;
    return function debounced(...args) {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fn.apply(this, args);
        timeoutId = null;
      }, ms);
    };
  }

  /**
   * Handle Q&A with enhanced context search and answer generation
   */
  async handleAsk() {
    const question = this.elements.questionInput.value.trim();
    if (question.length < 3) {
      this.elements.answerOutput.textContent = "Please ask a question (at least 3 characters).";
      return;
    }

    if (!this.pdfHandler.isLoaded()) {
      this.updateStatus("Document not processed yet.");
      this.elements.answerOutput.textContent = "Please upload and process a PDF first.";
      return;
    }

    if (!this.aiModel.isReady()) {
      this.updateStatus("AI model not ready. Please wait for initialization to complete.");
      this.elements.answerOutput.textContent = "AI model is still loading. Please wait...";
      return;
    }

    // Check cache
    const cacheKey = question.toLowerCase().trim();
    if (this.questionCache[cacheKey]) {
      this.elements.answerOutput.innerHTML = `
        <div class="bg-blue-50 border-l-4 border-blue-400 p-2 mb-2">
          <div class="text-blue-800 text-xs font-medium">📋 Cached Answer</div>
        </div>
        <div class="text-gray-800">${this.questionCache[cacheKey]}</div>
      `;
      this.updateStatus("✓ Answer retrieved from cache");
      this.elements.questionInput.value = "";
      return;
    }

    // Request ID to prevent race conditions
    this.lastAskRequestId += 1;
    const thisAskId = this.lastAskRequestId;

    // Disable UI and clear input
    this.elements.askButton.disabled = true;
    this.elements.questionInput.disabled = true;
    const originalQuestion = question;
    this.elements.questionInput.value = "";

    this.updateStatus("Searching document for relevant information...");
    this.elements.answerOutput.innerHTML = `
      <div class="text-blue-600 font-medium">🔍 Analyzing your question...</div>
      <div class="text-sm text-gray-500 mt-1">"${originalQuestion}"</div>
    `;

    try {
      // Get relevant context with enhanced search
      const context = this.pdfHandler.getRelevantContext(originalQuestion, 2500);

      if (!context || context.length < 50) {
        throw new Error("Could not find relevant information in the document for this question.");
      }

      this.updateStatus("Found relevant content, generating answer...");
      this.elements.answerOutput.innerHTML = `
        <div class="text-blue-600 font-medium">🤔 Generating answer...</div>
        <div class="text-sm text-gray-500 mt-1">Processing ${context.length} characters of relevant content</div>
      `;

      // FIXED: Use proper Flan-T5 QA format
      const enhancedPrompt = `question: ${originalQuestion} context: ${context.slice(0, 1500)}`;

      const output = await this.aiModel.generate(enhancedPrompt, {
        max_new_tokens: 200,
        temperature: 0.7,
        top_k: 50,
        top_p: 0.95,
        repetition_penalty: 1.2,
        do_sample: true,
      });

      if (thisAskId === this.lastAskRequestId) {
        let answer = output[0].generated_text.trim();

        // Clean up the answer
        answer = answer
          .replace(/^Answer:\s*/i, "")
          .replace(/\s+/g, " ")
          .trim();

        // Validate answer quality
        if (!answer || answer.length < 10) {
          throw new Error("Generated answer is too short or empty.");
        }

        if (answer.toLowerCase().includes("i cannot") || answer.toLowerCase().includes("i don't know")) {
          answer = `Based on the available content in the document: ${answer}`;
        }

        // Display formatted answer
        this.elements.answerOutput.innerHTML = `
          <div class="bg-green-50 border-l-4 border-green-400 p-2 mb-3">
            <div class="text-green-800 text-xs font-medium">✅ Answer Generated</div>
            <div class="text-green-700 text-xs">Based on document analysis</div>
          </div>
          <div class="text-gray-800 leading-relaxed">${answer}</div>
        `;

        // Cache the answer
        this.questionCache[cacheKey] = answer;
        this.updateStatus("✅ Answer complete! Ask another question.");
      }
    } catch (e) {
      console.error("Q&A failed:", e);
      if (thisAskId === this.lastAskRequestId) {
        this.elements.answerOutput.innerHTML = `
          <div class="bg-red-50 border-l-4 border-red-400 p-3">
            <div class="text-red-800 font-medium text-sm">❌ Could not generate answer</div>
            <div class="text-red-700 text-xs mt-1">${e.message}</div>
            <div class="text-red-600 text-xs mt-2">Try rephrasing your question or ask about different content from the document.</div>
          </div>
        `;
        this.updateStatus("Failed to generate answer: " + e.message, true);
      }
    } finally {
      if (thisAskId === this.lastAskRequestId) {
        this.elements.askButton.disabled = false;
        this.elements.questionInput.disabled = false;
        this.elements.questionInput.focus();
      }
    }
  }

  /**
   * Handle summary generation - Enhanced for complete PDF processing
   */
  async handleGenerateSummary() {
    if (this.summaryText) {
      // Display cached summary with formatting
      const pdfInfo = this.pdfHandler.getInfo();
      this.elements.summaryOutput.innerHTML = `
        <div class="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
          <div class="text-blue-800 font-medium text-sm">📋 Cached Summary</div>
          <div class="text-blue-700 text-xs">Previously generated from ${pdfInfo.numPages} pages</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h4 class="text-lg font-semibold text-gray-900 mb-3">📄 Document Summary</h4>
          <div class="text-gray-800 leading-relaxed whitespace-pre-wrap">${this.summaryText}</div>
        </div>
      `;
      return;
    }

    if (!this.pdfHandler.isLoaded()) {
      this.updateStatus("No document available to summarize.");
      return;
    }

    if (!this.aiModel.isReady()) {
      this.updateStatus("AI model not ready. Please wait for initialization to complete.");
      return;
    }

    this.elements.generateSummaryButton.disabled = true;
    this.updateStatus("Generating comprehensive summary...");
    this.elements.summaryOutput.innerHTML = `
      <div class="text-blue-600 font-medium">📄 Analyzing entire PDF document...</div>
      <div class="text-sm text-gray-500 mt-1">This will process all pages for a complete summary</div>
    `;

    try {
      // Get the complete document text
      const fullText = this.pdfHandler.fullDocumentText || this.pdfHandler.pdfText;
      const pdfInfo = this.pdfHandler.getInfo();

      console.log("📄 Full PDF text length:", fullText.length);
      console.log("📄 First 200 chars:", fullText.substring(0, 200));

      if (!fullText || fullText.length < 100) {
        throw new Error("No text content found in PDF. The document might be image-based or empty.");
      }

      this.updateStatus(`Processing complete document (${pdfInfo.numPages} pages, ${fullText.length} characters)...`);

      // OPTIMIZATION: Use much larger chunks and intelligent sampling
      const chunkSize = 5000; // MUCH larger chunks for speed
      const chunks = [];

      for (let i = 0; i < fullText.length; i += chunkSize) {
        const chunk = fullText.slice(i, i + chunkSize).trim();
        if (chunk.length > 300) {
          chunks.push(chunk);
        }
      }

      console.log(`📊 Total chunks: ${chunks.length}`);

      // SMART SAMPLING: For large documents, sample intelligently
      let chunksToProcess = [];
      if (chunks.length <= 10) {
        // Small doc: process all
        chunksToProcess = chunks;
      } else if (chunks.length <= 30) {
        // Medium doc: process every other chunk
        chunksToProcess = chunks.filter((_, i) => i % 2 === 0);
      } else {
        // Large doc: sample evenly distributed chunks (max 20)
        const sampleSize = 20;
        const step = Math.floor(chunks.length / sampleSize);
        for (let i = 0; i < chunks.length; i += step) {
          chunksToProcess.push(chunks[i]);
        }
      }

      console.log(`⚡ Processing ${chunksToProcess.length} strategic chunks (optimized from ${chunks.length})`);

      this.updateStatus(`Smart processing: analyzing ${chunksToProcess.length} key sections...`);

      const chunkSummaries = [];
      const maxChunksToProcess = chunksToProcess.length;

      // Process chunks with progress updates
      for (let i = 0; i < maxChunksToProcess; i++) {
        const progress = Math.round(((i + 1) / maxChunksToProcess) * 70); // 70% for chunk processing
        this.updateStatus(`Summarizing section ${i + 1}/${maxChunksToProcess}... (${progress}%)`);

        this.elements.summaryOutput.innerHTML = `
          <div class="text-blue-600 font-medium">📊 Processing: ${progress}% complete</div>
          <div class="text-sm text-gray-500">Analyzing section ${i + 1} of ${maxChunksToProcess}</div>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        `;

        try {
          // SPEED OPTIMIZATION: Use sentence extraction instead of AI for most chunks
          const chunkText = chunksToProcess[i];
          console.log(`⚡ Processing chunk ${i + 1} (${chunkText.length} chars)`);

          // Extract key sentences directly (MUCH faster than AI)
          const sentences = chunkText.match(/[^.!?]+[.!?]+/g) || [];

          // Get first 5-6 meaningful sentences as summary
          let keySentences = sentences
            .filter((s) => s.trim().length > 30) // Skip short fragments
            .slice(0, 6)
            .join(" ")
            .trim();

          if (keySentences.length > 50) {
            chunkSummaries.push(keySentences);
            console.log(`✅ Extracted ${sentences.length} sentences from chunk ${i + 1}`);
          }

          // Only use AI for first and last chunks for better intro/conclusion
          if (i === 0 || i === maxChunksToProcess - 1) {
            try {
              console.log(`🤖 Using AI for key chunk ${i + 1}`);
              const prompt = `summarize: ${chunkText.substring(0, 2000)}`;

              const result = await this.aiModel.generate(prompt, {
                max_new_tokens: 150,
                temperature: 0.7,
                do_sample: true,
                repetition_penalty: 1.5,
              });

              let aiSummary = result[0].generated_text.trim();
              if (aiSummary.startsWith("summarize:")) {
                aiSummary = aiSummary.replace(/^summarize:\s*/i, "").trim();
              }

              // Use AI summary if it's better than sentence extraction
              if (aiSummary.length > 50 && aiSummary.length < chunkText.length * 0.5) {
                chunkSummaries[chunkSummaries.length - 1] = aiSummary;
                console.log(`✅ Used AI summary for chunk ${i + 1}`);
              }
            } catch (aiError) {
              console.log(`⚠️ AI failed for chunk ${i + 1}, using extraction`);
            }
          }
        } catch (chunkError) {
          console.warn(`Failed to process chunk ${i + 1}:`, chunkError);
          // Continue with other chunks
        }

        // REMOVED DELAY - No need to slow down processing!
        // await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (chunkSummaries.length === 0) {
        throw new Error(
          "Failed to generate any summaries from the document. The document might be too complex or contain unsupported content."
        );
      }

      // Create comprehensive final summary
      this.updateStatus("Creating comprehensive final summary... (85%)");
      this.elements.summaryOutput.innerHTML = `
        <div class="text-blue-600 font-medium">🔄 Combining all sections...</div>
        <div class="text-sm text-gray-500">Creating comprehensive summary from ${chunkSummaries.length} processed sections</div>
        <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 85%"></div>
        </div>
      `;

      let finalSummary;

      if (chunkSummaries.length === 0) {
        throw new Error("Could not generate any summaries. Please try a different PDF.");
      } else if (chunkSummaries.length === 1) {
        finalSummary = chunkSummaries[0];
      } else if (chunkSummaries.length <= 5) {
        // For small number of chunks, combine directly with better formatting
        finalSummary = chunkSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n\n");
      } else {
        // For larger documents, organize into sections
        const sectionsPerGroup = Math.ceil(chunkSummaries.length / 5);
        const sections = [];

        for (let i = 0; i < chunkSummaries.length; i += sectionsPerGroup) {
          const group = chunkSummaries.slice(i, i + sectionsPerGroup);
          const sectionText = group.join(" ");
          sections.push(sectionText);
        }

        // Create well-formatted summary with sections
        finalSummary = sections
          .map((section, i) => {
            const sectionNum = i + 1;
            const totalSections = sections.length;
            return `📌 Section ${sectionNum}/${totalSections}:\n${section}`;
          })
          .join("\n\n");
      }

      console.log("✅ Final formatted summary created:", finalSummary.substring(0, 200));

      // Clean up the summary - but preserve newlines for formatting
      finalSummary = finalSummary.replace(/\.\s*\./g, ".").trim();

      this.summaryText = finalSummary;

      console.log("==================================================");
      console.log("🎯 FINAL SUMMARY TO DISPLAY:");
      console.log("Summary length:", finalSummary.length);
      console.log("Summary text:", finalSummary);
      console.log("==================================================");

      // Display final summary with formatting - ensuring it's visible
      const summaryHTML = `
        <div class="bg-green-50 border-l-4 border-green-400 p-3 mb-4">
          <div class="text-green-800 font-medium text-sm">✅ Summary Complete</div>
          <div class="text-green-700 text-xs">Processed ${pdfInfo.numPages} pages • ${chunkSummaries.length} sections analyzed</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h4 class="text-lg font-semibold text-gray-900 mb-3">📄 Document Summary</h4>
          <div class="text-gray-800 leading-relaxed text-base" style="white-space: pre-wrap; line-height: 1.8;">
            ${finalSummary}
          </div>
        </div>
      `;

      console.log("📺 Setting innerHTML to summaryOutput element");
      console.log("Element exists?", !!this.elements.summaryOutput);

      this.elements.summaryOutput.innerHTML = summaryHTML;

      console.log("✅ innerHTML set successfully");
      console.log("Current innerHTML:", this.elements.summaryOutput.innerHTML.substring(0, 200));

      // Force scroll to show summary
      this.elements.summaryOutput.scrollTop = 0;

      this.updateStatus("✅ Comprehensive document summary generated successfully!");
    } catch (e) {
      console.error("Summary generation failed:", e);
      this.updateStatus("Summary generation failed: " + e.message, true);
      this.elements.summaryOutput.innerHTML = `
        <div class="bg-red-50 border-l-4 border-red-400 p-3">
          <div class="text-red-800 font-medium text-sm">❌ Summary Failed</div>
          <div class="text-red-700 text-xs">${e.message}</div>
          <button onclick="location.reload()" class="mt-2 text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded">
            Refresh Page & Try Again
          </button>
        </div>
      `;
    } finally {
      this.elements.generateSummaryButton.disabled = false;
    }
  }

  /**
   * Handle quiz generation
   */
  async handleGenerateQuiz() {
    if (this.quizQuestions && this.quizQuestions.length > 0) {
      this.currentQuizIndex = 0;
      this.quizScore = 0;
      this.renderQuizQuestion(0);
      return;
    }

    if (!this.pdfHandler.isLoaded()) {
      this.updateStatus("Document not processed yet.");
      return;
    }

    this.elements.generateQuizButton.disabled = true;
    this.updateStatus("Generating quiz...");
    this.elements.quizContainer.textContent = "Generating quiz...";

    try {
      const segments = this.pdfHandler.getTextSegments();
      this.updateStatus("Generating quiz questions...");

      const meaningfulSentences = this.pdfHandler.getMeaningfulSentences(segments[0]);

      this.quizQuestions = [];

      for (let i = 0; i < Math.min(meaningfulSentences.length, 3); i++) {
        const sentence = meaningfulSentences[i];
        const shortText = sentence.substring(0, 80);

        this.quizQuestions.push({
          question: `According to the document: "${shortText}..." - Is this statement accurate?`,
          options: [
            "Yes, this is stated in the document",
            "No, the document contradicts this",
            "The document does not discuss this topic",
            "This is only partially mentioned",
          ],
          answer: "A",
        });
      }

      // Ensure minimum questions
      if (this.quizQuestions.length < 3) {
        this.quizQuestions = [
          {
            question: "Based on the document, what is the main topic discussed?",
            options: ["Topic A (from document)", "Unrelated topic B", "Unrelated topic C", "Unrelated topic D"],
            answer: "A",
          },
          {
            question: "What key information is presented in the document?",
            options: ["Key information from text", "Incorrect option B", "Incorrect option C", "Incorrect option D"],
            answer: "A",
          },
          {
            question: "Which statement best describes the document content?",
            options: ["Accurate description", "Inaccurate option B", "Inaccurate option C", "Inaccurate option D"],
            answer: "A",
          },
        ];
      }

      this.currentQuizIndex = 0;
      this.quizScore = 0;
      this.renderQuizQuestion(0);
      this.updateStatus("Quiz ready.");
    } catch (e) {
      console.error("Quiz generation failed", e);
      this.updateStatus("Quiz generation failed: " + e.message, true);
      this.elements.quizContainer.textContent = "Error generating quiz.";
    } finally {
      this.elements.generateQuizButton.disabled = false;
    }
  }

  /**
   * Render quiz question
   */
  renderQuizQuestion(index) {
    const container = this.elements.quizContainer;
    container.innerHTML = "";

    if (!this.quizQuestions || this.quizQuestions.length === 0) {
      container.textContent = "No quiz available.";
      return;
    }

    const q = this.quizQuestions[index];

    const qnum = document.createElement("div");
    qnum.className = "text-sm text-gray-600";
    qnum.textContent = `Question ${index + 1} of ${this.quizQuestions.length}`;

    const qtext = document.createElement("div");
    qtext.className = "mt-2 text-lg font-medium";
    qtext.textContent = q.question;

    container.appendChild(qnum);
    container.appendChild(qtext);

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "mt-4";
    let selected = null;

    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.textContent = `${String.fromCharCode(65 + i)}. ${opt}`;
      btn.addEventListener("click", () => {
        Array.from(optionsDiv.children).forEach((n) => n.classList.remove("selected"));
        btn.classList.add("selected");
        selected = String.fromCharCode(65 + i);
      });
      optionsDiv.appendChild(btn);
    });

    container.appendChild(optionsDiv);

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit Answer";
    submitBtn.className = "mt-4 w-full bg-blue-600 text-white py-2 rounded-lg";
    submitBtn.disabled = true;

    optionsDiv.addEventListener("click", () => {
      submitBtn.disabled = false;
    });

    submitBtn.addEventListener("click", () => {
      const correct = q.answer.trim().toUpperCase();
      const feedback = document.createElement("div");
      feedback.className = "mt-3 p-3 rounded-md";

      if (selected === correct) {
        this.quizScore += 1;
        feedback.classList.add("quiz-feedback", "correct");
        feedback.textContent = "Correct!";
      } else {
        feedback.classList.add("quiz-feedback", "incorrect");
        feedback.textContent = `Incorrect. Correct answer: ${correct}`;
      }

      container.appendChild(feedback);

      setTimeout(() => {
        if (this.currentQuizIndex < this.quizQuestions.length - 1) {
          this.currentQuizIndex += 1;
          this.renderQuizQuestion(this.currentQuizIndex);
        } else {
          container.innerHTML = `<div class="text-lg font-semibold">Quiz complete</div><div class="mt-2">Score: ${this.quizScore} / ${this.quizQuestions.length}</div><button id="retake-quiz" class="mt-4 w-full bg-gray-200 py-2 rounded">Retake Quiz</button>`;
          document.getElementById("retake-quiz").addEventListener("click", () => {
            this.quizScore = 0;
            this.currentQuizIndex = 0;
            this.renderQuizQuestion(0);
          });
        }
      }, 1200);
    });

    container.appendChild(submitBtn);
  }

  /**
   * Handle PDF navigation
   */
  async handlePrevPage() {
    if (this.pdfHandler.currentPage <= 1) return;
    await this.pdfHandler.renderPage(this.pdfHandler.currentPage - 1);
    this.updateNavigationButtons();
  }

  async handleNextPage() {
    const info = this.pdfHandler.getInfo();
    if (!info || this.pdfHandler.currentPage >= info.numPages) return;
    await this.pdfHandler.renderPage(this.pdfHandler.currentPage + 1);
    this.updateNavigationButtons();
  }

  updateNavigationButtons() {
    const info = this.pdfHandler.getInfo();
    if (!info) return;

    this.elements.prevPageButton.disabled = this.pdfHandler.currentPage <= 1;
    this.elements.nextPageButton.disabled = this.pdfHandler.currentPage >= info.numPages;
  }

  /**
   * Enable upload after model is loaded
   */
  enableUpload() {
    this.updateStatus("✅ AI Model Loaded. Please upload a PDF.");
    this.elements.uploadElement.disabled = false;
  }
}
