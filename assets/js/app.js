/**
 * Main Application Entry Point
 * Initializes and coordinates all modules with enhanced error handling
 */

import { AIModel } from "./ai-model.js";
import { PDFHandler } from "./pdf-handler.js";
import { UIController } from "./ui-controller.js";

// Initialize PDF.js worker with fallback
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;
} catch (e) {
  console.error("Failed to set PDF.js worker:", e);
}

/**
 * Application main function with enhanced error handling
 */
async function initializeApp() {
  console.log("🚀 QueryPDF initializing...");
  
  try {
    // Create instances
    const aiModel = new AIModel();
    const pdfHandler = new PDFHandler();
    const uiController = new UIController(pdfHandler, aiModel);

    // Add global error handlers
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      if (event.error?.message?.includes('fetch')) {
        uiController.updateStatus("Network error detected. Please check your internet connection.", true);
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      if (event.reason?.message?.includes('model')) {
        uiController.updateStatus("AI model loading issue. Please refresh the page.", true);
      }
    });

    // Initialize AI Model with retry logic
    let initAttempts = 0;
    const maxAttempts = 3;
    
    while (initAttempts < maxAttempts) {
      try {
        initAttempts++;
        uiController.updateStatus(`Initializing AI model... (Attempt ${initAttempts}/${maxAttempts})`);
        
        await aiModel.initialize((msg) => uiController.updateStatus(msg));
        uiController.enableUpload();
        console.log("✅ QueryPDF initialized successfully!");
        break;
        
      } catch (error) {
        console.error(`Initialization attempt ${initAttempts} failed:`, error);
        
        if (initAttempts >= maxAttempts) {
          // Final attempt failed
          const errorMsg = error.message.includes('network') || error.message.includes('fetch') 
            ? "Network connection issue. Please check your internet and refresh the page."
            : `Initialization failed: ${error.message}. Please refresh the page and try again.`;
            
          uiController.updateStatus(errorMsg, true);
          
          // Add retry button
          const statusElement = document.getElementById('status');
          if (statusElement) {
            statusElement.innerHTML = `
              <div class="text-red-700">${errorMsg}</div>
              <button onclick="location.reload()" class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                Refresh Page
              </button>
            `;
          }
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
  } catch (error) {
    console.error("Critical initialization error:", error);
    
    // Fallback error display
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div class="font-medium">❌ Application Failed to Start</div>
          <div class="text-sm mt-1">${error.message}</div>
          <button onclick="location.reload()" class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
            Refresh Page
          </button>
        </div>
      `;
    }
  }
}

/**
 * Check browser compatibility
 */
function checkBrowserCompatibility() {
  const issues = [];
  
  if (!window.WebAssembly) {
    issues.push("WebAssembly not supported");
  }
  
  if (!window.fetch) {
    issues.push("Fetch API not supported");
  }
  
  if (!window.Promise) {
    issues.push("Promises not supported");
  }
  
  if (issues.length > 0) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <div class="font-medium">⚠️ Browser Compatibility Issues</div>
          <div class="text-sm mt-1">Your browser may not support all features: ${issues.join(', ')}</div>
          <div class="text-sm mt-1">Please use a modern browser like Chrome, Firefox, or Safari.</div>
        </div>
      `;
    }
    return false;
  }
  
  return true;
}

// Start the application when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (checkBrowserCompatibility()) {
      initializeApp();
    }
  });
} else {
  if (checkBrowserCompatibility()) {
    initializeApp();
  }
}
