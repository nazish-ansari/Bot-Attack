/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Prevents excessive transactions from same IP address
 */
define(['N/record', 'N/runtime', 'N/search', 'N/email', 'N/format'],
    function(record, runtime, search, email, format) {
    
    // Configuration
    const MAX_ORDERS_PER_HOUR = 5;  // Adjust based on your normal traffic patterns
    const ADMIN_EMAIL = 'security@yourcompany.com';
    
    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE)
            return;
            
        try {
            // Only apply to web store orders
            if (!context.newRecord.getValue({fieldId: 'custbody_dps_order_source'}) || 
                context.newRecord.getValue({fieldId: 'custbody_dps_order_source'}) !== 'Web Store')
                return;
                
            const ipAddress = context.newRecord.getValue({fieldId: 'custbody_dps_customer_ip'});
            if (!ipAddress) return;
            
            // Check for recent orders from this IP
            const hourAgo = new Date();
            hourAgo.setHours(hourAgo.getHours() - 1);
            
            const orderSearch = search.create({
                type: search.Type.SALES_ORDER,
                filters: [
                    ['custbody_dps_customer_ip', 'is', ipAddress],
                    'AND',
                    ['datecreated', 'after', format.format({value: hourAgo, type: format.Type.DATETIME})]
                ]
            });
            
            const orderCount = orderSearch.runPaged().count;
            
            if (orderCount >= MAX_ORDERS_PER_HOUR) {
                // Flag the transaction
                context.newRecord.setValue({
                    fieldId: 'custbody_dps_bot_flag',
                    value: true
                });
                
                // Optional: Hold order for review
                context.newRecord.setValue({
                    fieldId: 'orderstatus',
                    value: 'B' // 'B' is Pending Approval
                });
                
                // Send alert to security team
                email.send({
                    author: runtime.getCurrentUser().id,
                    recipients: ADMIN_EMAIL,
                    subject: 'Possible Bot Attack Detected',
                    body: 'Multiple orders (' + orderCount + ') detected from IP: ' + ipAddress + 
                          ' within the past hour. The most recent order has been flagged and placed on hold. ' +
                          'Order #: ' + context.newRecord.getValue({fieldId: 'tranid'})
                });
                
                // Log to custom record for analysis
                record.create({
                    type: 'customrecord_dps_bot_detection_log',
                    isDynamic: true,
                    values: {
                        custrecord_dps_detection_timestamp: new Date(),
                        custrecord_dps_ip_address: ipAddress,
                        custrecord_dps_order_count: orderCount,
                        custrecord_dps_detection_type: 'Excessive Orders'
                    }
                }).save();
            }
        } catch (e) {
            log.error({
                title: 'Error in bot detection script',
                details: e.toString()
            });
        }
    }
    
    return {
        beforeSubmit: beforeSubmit
    };
});
