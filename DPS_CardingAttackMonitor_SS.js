/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 * @description Monitors for unusual credit card decline patterns indicating carding bot attacks
 */
define(['N/search', 'N/record', 'N/email', 'N/runtime'],
    function(search, record, email, runtime) {
    
    // Configuration
    const DECLINE_THRESHOLD = 40; // Percentage of declines that triggers an alert
    const MIN_TRANSACTIONS = 10;  // Minimum transactions to consider for analysis
    const ADMIN_EMAIL = 'security@yourcompany.com';
    
    function execute(context) {
        // Look at transactions from the past hour
        const hourAgo = new Date();
        hourAgo.setHours(hourAgo.getHours() - 1);
        
        // Get all payment events
        const paymentSearch = search.create({
            type: 'customrecord_payment_event', // Replace with your actual payment event record type
            filters: [
                ['created', 'after', hourAgo]
            ],
            columns: [
                'custrecord_payment_status',
                'custrecord_customer_ip',
                'custrecord_payment_method'
            ]
        });
        
        // Analyze by IP address
        const ipStats = {};
        let searchResult = paymentSearch.run().getRange({start: 0, end: 1000});
        
        if (searchResult && searchResult.length > 0) {
            for (let i = 0; i < searchResult.length; i++) {
                const ip = searchResult[i].getValue('custrecord_customer_ip');
                const status = searchResult[i].getValue('custrecord_payment_status');
                
                if (!ip) continue;
                
                if (!ipStats[ip]) {
                    ipStats[ip] = {
                        total: 0,
                        declined: 0
                    };
                }
                
                ipStats[ip].total++;
                if (status === 'DECLINED') {
                    ipStats[ip].declined++;
                }
            }
            
            // Check for suspicious IPs and take action
            for (let ip in ipStats) {
                const stats = ipStats[ip];
                
                // Only analyze IPs with sufficient transaction volume
                if (stats.total < MIN_TRANSACTIONS) continue;
                
                const declineRate = (stats.declined / stats.total) * 100;
                
                if (declineRate >= DECLINE_THRESHOLD) {
                    // Add IP to block list
                    record.create({
                        type: 'customrecord_blocked_ip',
                        isDynamic: true,
                        values: {
                            custrecord_ip_address: ip,
                            custrecord_block_reason: 'High decline rate: ' + declineRate.toFixed(2) + '%',
                            custrecord_block_timestamp: new Date(),
                            custrecord_block_duration: 24 // Block for 24 hours
                        }
                    }).save();
                    
                    // Send notification
                    email.send({
                        author: runtime.getCurrentUser().id,
                        recipients: ADMIN_EMAIL,
                        subject: 'Possible Carding Attack Detected',
                        body: 'High decline rate detected from IP: ' + ip + 
                              '\nTotal Transactions: ' + stats.total + 
                              '\nDeclined Transactions: ' + stats.declined + 
                              '\nDecline Rate: ' + declineRate.toFixed(2) + '%' +
                              '\n\nThis IP has been automatically blocked for 24 hours.'
                    });
                }
            }
        }
    }
    
    return {
        execute: execute
    };
});
