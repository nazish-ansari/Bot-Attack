/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @description Adds a honeypot field to checkout forms to detect bots
 */
define(['N/currentRecord', 'N/ui/message'],
    function(currentRecord, message) {
    
    function pageInit(context) {
        if (window.location.href.indexOf('/checkout') > -1) {
            // Only execute on checkout pages
            try {
                setTimeout(function() {
                    // Create a hidden field that humans won't see, but bots will fill
                    const honeypotField = document.createElement('input');
                    honeypotField.setAttribute('type', 'text');
                    honeypotField.setAttribute('name', 'customer_information');
                    honeypotField.setAttribute('id', 'customer_information');
                    honeypotField.setAttribute('autocomplete', 'off');
                    honeypotField.setAttribute('tabindex', '-1');
                    
                    // Hide it visually but keep it accessible to bots
                    honeypotField.style.position = 'absolute';
                    honeypotField.style.left = '-9999px';
                    honeypotField.style.height = '1px';
                    honeypotField.style.width = '1px';
                    honeypotField.style.opacity = '0';
                    
                    // Add it to the form
                    const form = document.querySelector('form');
                    if (form) {
                        form.appendChild(honeypotField);
                        
                        // Override the form submission
                        form.addEventListener('submit', function(e) {
                            if (honeypotField.value !== '') {
                                // Bot detected - prevent form submission
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Log the bot attempt
                                console.log('Bot attempt detected');
                                
                                // Optional: Show generic error to the bot
                                message.create({
                                    type: message.Type.ERROR,
                                    title: 'Error',
                                    message: 'There was a problem processing your request. Please try again later.',
                                    duration: 5000
                                }).show();
                                
                                // You could also redirect to a different page
                                // window.location.href = '/error-page';
                                
                                return false;
                            }
                        }, true);
                    }
                }, 1000); // Small delay to ensure the page is loaded
            } catch (e) {
                console.error('Error in honeypot script: ', e);
            }
        }
    }
    
    return {
        pageInit: pageInit
    };
});
