/**
 * AI Model Handler
 * Manages the loading and initialization of AI models
 */

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js";

export class AIModel {
  constructor() {
    this.generationModel = null;
    this.isInitialized = false;
  }

  /**
   * Load a model with progress callback and better error handling
   */
  async loadModel(pipelineType, modelId, options = {}) {
    const progressCallback = (data) => {
      if (data.status === "progress") {
        const modelName = data.name.split("/").pop();
        const percent = Math.round(data.progress || 0);
        this.updateStatus(`Loading ${modelName}... (${percent}%)`);
      } else if (data.status === "ready") {
        console.log("Model ready:", data.name);
      } else if (data.status === "initiate") {
        this.updateStatus(`Initializing ${data.name}...`);
      }
    };

    // Configure environment for better compatibility
    env.allowRemoteModels = true;
    env.allowLocalModels = false;
    
    // Use CPU backend for better compatibility
    const pipelineOptions = {
      progress_callback: progressCallback,
      quantized: true,
      ...options
    };

    return await pipeline(pipelineType, modelId, pipelineOptions);
  }

  /**
   * Initialize AI model with better error handling
   */
  async initialize(statusCallback) {
    this.updateStatus = statusCallback;

    if (this.isInitialized && this.generationModel) {
      this.updateStatus("✅ AI Model already loaded and ready!");
      return true;
    }

    const generationId = "Xenova/flan-t5-small";
    console.log("Loading model from:", generationId);

    try {
      // Load the Text Generation Model
      this.updateStatus("Loading AI Model (first time downloads ~850MB, then cached)...");
      
      this.generationModel = await this.loadModel("text2text-generation", generationId, {
        revision: 'main',
        cache_dir: './.cache'
      });

      // Run warmup inference to prime caches
      this.updateStatus("Warming up model...");
      try {
        const warmupResult = await this.generationModel("Test warmup", { 
          max_new_tokens: 5, 
          do_sample: false, 
          num_beams: 1,
          early_stopping: true
        });
        console.log("Model warmup complete:", warmupResult);
      } catch (warmupErr) {
        console.warn("Warmup inference failed, but continuing:", warmupErr);
      }

      // Mark as initialized
      this.isInitialized = true;

      // Expose model for debugging in the console
      window.generationModel = this.generationModel;

      return true;
    } catch (e) {
      console.error("Model loading failed:", e);
      this.isInitialized = false;
      
      // Provide more specific error messages
      let errorMessage = "Error loading AI model. ";
      if (e.message.includes("fetch")) {
        errorMessage += "Network connection issue. Please check your internet connection and try again.";
      } else if (e.message.includes("quota")) {
        errorMessage += "Storage quota exceeded. Please clear browser cache and try again.";
      } else {
        errorMessage += `${e.message}. Please refresh the page and try again.`;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Generate text using the model with error handling
   */
  async generate(prompt, options = {}) {
    if (!this.generationModel || !this.isInitialized) {
      throw new Error("AI model not initialized. Please wait for the model to load.");
    }
    
    try {
      const result = await this.generationModel(prompt, options);
      return result;
    } catch (error) {
      console.error("Text generation failed:", error);
      throw new Error(`Text generation failed: ${error.message}`);
    }
  }

  /**
   * Check if model is ready
   */
  isReady() {
    return this.generationModel !== null && this.isInitialized;
  }

  /**
   * Get model status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasModel: this.generationModel !== null,
      isReady: this.isReady()
    };
  }
}
