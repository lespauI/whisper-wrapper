/**
 * Event Handler Utilities
 * Provides safe event listener management and common event handling patterns
 */

export class EventHandler {
    /**
     * Safely add event listener to a single element
     * @param {string} selector - CSS selector or element ID (with #)
     * @param {string} event - Event type
     * @param {function} callback - Event callback function
     * @param {Element} [context=document] - Context to search within
     * @returns {boolean} True if listener was added successfully
     */
    static addListener(selector, event, callback, context = document) {
        const element = selector.startsWith('#') ? 
            context.getElementById(selector.substring(1)) : 
            context.querySelector(selector);
            
        if (element) {
            element.addEventListener(event, callback);
            return true;
        } else {
            console.warn(`Element not found: ${selector}`);
            return false;
        }
    }

    /**
     * Safely add event listeners to multiple elements
     * @param {string} selector - CSS selector
     * @param {string} event - Event type
     * @param {function} callback - Event callback function
     * @param {Element} [context=document] - Context to search within
     * @returns {number} Number of listeners added
     */
    static addListenerAll(selector, event, callback, context = document) {
        const elements = context.querySelectorAll(selector);
        if (elements.length > 0) {
            elements.forEach(el => el.addEventListener(event, callback));
            return elements.length;
        } else {
            console.warn(`No elements found for: ${selector}`);
            return 0;
        }
    }

    /**
     * Remove event listener from element
     * @param {string} selector - CSS selector or element ID (with #)
     * @param {string} event - Event type
     * @param {function} callback - Event callback function
     * @param {Element} [context=document] - Context to search within
     * @returns {boolean} True if listener was removed successfully
     */
    static removeListener(selector, event, callback, context = document) {
        const element = selector.startsWith('#') ? 
            context.getElementById(selector.substring(1)) : 
            context.querySelector(selector);
            
        if (element) {
            element.removeEventListener(event, callback);
            return true;
        } else {
            console.warn(`Element not found: ${selector}`);
            return false;
        }
    }

    /**
     * Debounce function calls
     * @param {function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {function} Debounced function
     */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Throttle function calls
     * @param {function} func - Function to throttle
     * @param {number} delay - Delay in milliseconds
     * @returns {function} Throttled function
     */
    static throttle(func, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return func.apply(this, args);
            }
        };
    }

    /**
     * Create a safe async event handler that catches errors
     * @param {function} asyncHandler - Async function to wrap
     * @param {function} [errorHandler] - Optional error handler
     * @returns {function} Safe async event handler
     */
    static createAsyncHandler(asyncHandler, errorHandler = console.error) {
        return async function(event) {
            try {
                await asyncHandler.call(this, event);
            } catch (error) {
                errorHandler(error);
            }
        };
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     * @param {Object} shortcuts - Object mapping shortcuts to handlers
     */
    static handleKeyboardShortcut(event, shortcuts) {
        for (const [shortcut, handler] of Object.entries(shortcuts)) {
            const keys = shortcut.split('+');
            let matches = true;

            // Check if all required keys are pressed
            for (const key of keys) {
                switch (key.toLowerCase()) {
                    case 'ctrl':
                        if (!event.ctrlKey) matches = false;
                        break;
                    case 'shift':
                        if (!event.shiftKey) matches = false;
                        break;
                    case 'alt':
                        if (!event.altKey) matches = false;
                        break;
                    default:
                        if (event.key.toLowerCase() !== key.toLowerCase()) matches = false;
                        break;
                }
            }

            if (matches) {
                event.preventDefault();
                handler(event);
                break;
            }
        }
    }

    /**
     * Prevent default behavior and stop propagation
     * @param {Event} event - Event to prevent
     */
    static preventDefault(event) {
        event.preventDefault();
        event.stopPropagation();
    }
}