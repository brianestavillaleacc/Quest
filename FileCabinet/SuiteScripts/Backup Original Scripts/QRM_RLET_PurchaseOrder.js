/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
define(['N/record', 'N/error', 'N/log'],
    function (record, error, myLog) {

        function debugLog(title, details) {
            myLog.debug({
                title: title,
                details: details
            });
        }

        function errorLog(title, details) {
            myLog.error({
                title: title,
                details: details
            });
        }
        function doValidation(args, argNames, methodName) {
            for (var i = 0; i < args.length; i++)
                if (!args[i] && args[i] !== 0)
                    throw error.create({
                        name: 'MISSING_REQ_ARG',
                        message: 'Missing a required argument: [' + argNames[i] + '] for method: ' + methodName
                    });
        }
        // Get a standard NetSuite record
        function _get(context) {

        }
        // Delete a standard NetSuite record
        function _delete(context) {

        }
        // Create a NetSuite record from request params
        function post(context) {

        }
        // Upsert a NetSuite record from request param
        function put(context) {
            try {
                doValidation([context.id], ['id'], 'PUT');
                
                debugLog('Testing', 'id = ' + context.id);
                debugLog('Testing', 'context = ' + context);
                
                for (var fldName in context) {
                	debugLog('Testing', 'fldName = ' + fldName + ', value = ' + context[fldName]);
                	debugLog('Testing', 'context.hasOwnProperty(fldName) = ' + context.hasOwnProperty(fldName));
                	
                	if (context.hasOwnProperty(fldName)) {
                        if (fldName === 'items') {
                        	debugLog('Testing', 'context.items.length = ' + context.items.length);
                        	
                        	for (var x = 0; x < context.items.length; x++) {
                        		debugLog('Testing', 'context.items[x].line_num = ' + context.items[x].line_num);
                        		debugLog('Testing', 'context.items[x].qty = ' + context.items[x].qty);
                        	}
                        }
                	}
                }
                
                debugLog('Testing', 'Try to load PO.');
                
                var rec = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: context.id
                });
                
                debugLog('Testing', 'Try to load items sublist.');
                
                var sublist = rec.getSublist({
                    sublistId: 'item'
                });
                
                debugLog('Testing', 'Try to loop over field names in the context.');
                
                for (var fldName in context) {
                    if (context.hasOwnProperty(fldName)) {
                        if (fldName === 'items') {
                            for (var x = 0; x < context.items.length; x++) {
                                rec.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    line: context.items[x].line_num - 1,
                                    value: context.items[x].qty
                                });
                            }
                        }
                        else if (fldName !== 'id' && fldName !== 'custbody_request_date' && fldName !== 'custbody_service_date')
                            rec.setValue(fldName, context[fldName]);
                        else if (fldName !== 'id')
                            rec.setText(fldName, context[fldName]);
                    }
                }
                
                debugLog('Testing', 'Try to save the PO.');
                
                rec.save();
                return JSON.stringify(rec);
            } catch (error) {
                throw error.create({
                    name: 'ERROR_PO_UPDATE',
                    message: 'Please forward to your NetSuite Consultant \nMessage: ' + JSON.stringify(error)
                });
            }
        }
        return {
            // get: _get,
            // delete: _delete,
            // post: post,
            put: put
        };
    });