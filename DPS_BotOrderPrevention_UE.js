/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Prevents excessive transactions from same IP address
 */
define(['N/record', 'N/runtime', 'N/search', 'N/email', 'N/format'],
    function (record, runtime, search, email, format) {

        // Configuration
        const MAX_ORDERS_PER_HOUR = 5;  // Adjust based on your normal traffic patterns
        const ADMIN_EMAIL = 'Nazish@dpstechs.com';

        function beforeSubmit(context) {
            if (context.type !== context.UserEventType.DELETE)
            {
            try {
                log.debug('runtime.executionContext', runtime.executionContext)
                // Only apply to web store orders
                if (runtime.executionContext === runtime.ContextType.WEBSERVICES || runtime.executionContext === runtime.ContextType.CUSTOMER_CENTER || runtime.executionContext === runtime.ContextType.USER_INTERFACE) {
                    context.newRecord.setValue({
                        fieldId: 'custbody_dps_order_source',
                        value: 'Web Store'
                    });

                    const ipAddress = context.newRecord.getValue({ fieldId: 'custbody_dps_customer_ip' });
                    if (!ipAddress) return;
                    log.debug('ipAddress', ipAddress)

                    // Check for recent orders from this IP
const now = new Date();
now.setMinutes(now.getMinutes() + 1); // Add 1 minute

const todayMidnight = new Date();
todayMidnight.setHours(0, 0, 0, 0);

// Custom formatted strings (no seconds)
const midnightStr = formatDateNoSeconds(todayMidnight);
const nowStr = formatDateNoSeconds(now);

log.debug('Search Window', midnightStr + ' → ' + nowStr);

const orderSearch = search.create({
    type: search.Type.SALES_ORDER,
    filters: [
        ['type','anyof','SalesOrd'], 'AND',
        ['mainline','is','T'], 'AND',
        ['custbody_dps_customer_ip','is', ipAddress], 'AND',
        ['datecreated','onorafter', midnightStr, nowStr]
    ]
});

                    const orderCount = orderSearch.runPaged().count;
                    log.debug('orderCount', orderCount)
                    log.debug('MAX_ORDERS_PER_HOUR', MAX_ORDERS_PER_HOUR)

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
                                'Order #: ' + context.newRecord.getValue({ fieldId: 'tranid' })
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
                }
            } catch (e) {
                log.error({
                    title: 'Error in bot detection script',
                    details: e
                });
            }
            }
        }

        return {
            beforeSubmit: beforeSubmit
        };
      function formatDateNoSeconds(dateObj) {
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();

    let hours = dateObj.getHours();
    let minutes = dateObj.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 → 12
    minutes = minutes < 10 ? '0' + minutes : minutes;

    return month + '/' + day + '/' + year + ' ' + hours + ':' + minutes + ' ' + ampm;
}
    });
