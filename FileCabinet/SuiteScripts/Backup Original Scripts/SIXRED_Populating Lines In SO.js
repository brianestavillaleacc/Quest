/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       24 Apr 2015     Siva Kalyan      This script is used to populate Line numbers and Items in SO
 * 2.00		  25 Feb 2018	 Jaret Cuglewski   Cleaned up and refactored existing code.
 * 3.00		  22 Mar 2018	 Jaret Cuglewski   Refactored code and how business logic is triggered.
 * 4.00		  25 Sep 2018	 Jaret Cuglewski   Added in support for two additional line item columns (custcolservice_document and custcolcustcol_client_po).
 * 5.00       20 Jan  2020   Frank Chiuppi	    New pricing method Variable Vendor Cost logic added.
 * 
 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
 * 
 * @appliedtorecord recordType
 * 
 * @param {String}
 *            type Operation types: create, edit, delete, xedit approve, reject,
 *            cancel (SO, ER, Time Bill, PO & RMA only) pack, ship (IF)
 *            markcomplete (Call, Task) reassign (Case) editforecast 
 *            (Opp, Estimate) scheduled userinterface 
 * @returns {Void}
 */
function populatingLinesInSO(type)
{
	LogExecutionAudit('Begin \'SIXRED_Populating Lines In So\' User Event Script', 'populatingLinesInSO');

    var context = nlapiGetContext().getExecutionContext();

    LogExecutionDebug('', 'Trigger Type = ' + type);
    LogExecutionDebug('', 'Context = ' + context);
    LogExecutionDebug('', 'PO ID = ' + nlapiGetRecordId());	
    LogExecutionAudit('', 'Check if record is in edit mode.');
    
    if (type == 'edit')
    	{
	    	LogExecutionAudit('', 'Record is in edit mode.');
	    	LogExecutionAudit('', 'Check to make sure that the context is as expected before processing.');
	    	
    		if (context == 'userinterface' || 
				context == 'webservices' || 
				context == 'restlet' || 
        		context == 'csvimport' || 
        		context == 'suitelet' || 
        		context == 'custommassupdate' || 
        		context == 'webstore' || 
        		context == 'userevent' || 
        		(context == 'scheduled' && nlapiGetFieldValue('custbody_ba_flag_update') == 'T')) {
    			
    			LogExecutionAudit('', 'The context is as expected so we can continue processing.');
            
    			var specialServiceFlag = 'false';
    			var lineItemCount = nlapiGetLineItemCount('item');        
    			var requestDate = nlapiGetFieldValue('custbody_request_date');

				LogExecutionDebug('', 'lineItemCount = ' + lineItemCount);
            LogExecutionDebug('', 'requestDate = ' + requestDate);

            for (var itemLines = 1; itemLines <= lineItemCount; itemLines++)
            {
            		var isSpecialOrder = nlapiGetLineItemValue('item', 'custcol_special_services', itemLines);
                
                if (isSpecialOrder == 'T')
                {
                		specialServiceFlag = 'true';
                		itemLines = lineItemCount + 1;
                }
            }

            LogExecutionDebug('', 'specialServiceFlag = ' + specialServiceFlag);

            if (specialServiceFlag == 'true') 
            {
            		LogExecutionError('Cannot Continue Executing Script (Special Services)', 'SO UPDATE REQUIRED.');

            		nlapiSetFieldValue('custbody_test_message', '<font size="2.5" color="red"><b>SO UPDATE REQUIRED</b></font>');
            }

            if (specialServiceFlag == 'false')
            {
        			var salesOrderId = nlapiGetFieldValue('createdfrom');
        			
        			LogExecutionDebug('', 'salesOrderId = ' + salesOrderId);

        			if (salesOrderId)
        			{
        				try
    					{
        					LogExecutionAudit('', 'Retrieving the sales order.');

        					var salesOrder = nlapiLoadRecord('salesorder', salesOrderId);
    					} catch (e) {
                    		LogExecutionError('Issue(s) In Executing The Script (Retrieving the SO)', e);
                        
                         return;
    					}

                    	var oldQty = new Array();
                    	var dateObj = new Date();
                    	var oldDesc = new Array();
                    	var oldClose = new Array();
                    	var oldItems = new Array();
                    	var oldRates = new Array();
                    	var oldClientServicePo = new Array();
                    	var oldServiceDocument = new Array();
                        var oldMpInternalId = new Array();//Frank added to test adding to sales order on PO update
                    	var oldPo = nlapiGetOldRecord();
                    	var vendor = nlapiGetFieldValue('entity');
                    	var customer = salesOrder.getFieldValue('entity');
	            		var dateString = nlapiDateToString(dateObj, 'date');
	            		var oldLineItemCount = oldPo.getLineItemCount('item');
	            		var saleOrderLineItemCount = salesOrder.getLineItemCount('item');

	            		LogExecutionDebug('', 'vendor = ' + vendor);
	            		LogExecutionDebug('', 'customer = ' + customer);
	            		LogExecutionDebug('', 'dateString (today\'s date) = ' + dateString);
	            		LogExecutionDebug('', 'oldPo oldLineItemCount = ' + oldLineItemCount);
	            		LogExecutionDebug('', 'lineItemCount (confirmation) = ' + lineItemCount);
	            		LogExecutionDebug('', 'saleOrderLineItemCount = ' + saleOrderLineItemCount);

	            		// Getting old record info for comparing a change in rate quantity item
	            		for (var oldLine = 1; oldLine <= oldLineItemCount; oldLine++)
	            		{
                			LogExecutionAudit('', 'Store Required Values in Arrays for Line = ' + oldLine);

                			// Storing required field values into arrays.
                			oldItems[oldItems.length] = oldPo.getLineItemValue('item', 'item', oldLine);
                			oldRates[oldRates.length] = oldPo.getLineItemValue('item', 'rate', oldLine);
                			oldQty[oldQty.length] = oldPo.getLineItemValue('item', 'quantity', oldLine);
                			oldDesc[oldDesc.length] = oldPo.getLineItemValue('item', 'description', oldLine);
                			oldClose[oldClose.length] = oldPo.getLineItemValue('item', 'isclosed', oldLine);
                			oldClientServicePo[oldClientServicePo.length] = oldPo.getLineItemValue('item', 'custcolcustcol_client_po', oldLine);
                			oldServiceDocument[oldServiceDocument.length] = oldPo.getLineItemValue('item', 'custcolservice_document', oldLine);
                            oldMpInternalId[oldMpInternalId.length] = oldPo.getLineItemValue('item', 'custcol_mp_internal_id', oldLine);//frank testing add
	            		}

	            		for (var line = 1; line <= lineItemCount; line++)
	            		{
                	    		LogExecutionAudit('', 'Processing Line Item');
                    	    LogExecutionDebug('', 'line = ' + line);

                    	    var soLineToUpdate = line;
                    	    var changedData = 'false';
                    	    var soNumber = nlapiGetLineItemValue('item', 'custcol_soline_no', line);
                    	    var close = nlapiGetLineItemValue('item', 'isclosed', line);
                    	    var rate = parseFloat(nlapiGetLineItemValue('item', 'rate', line));
                    	    var quantity = nlapiGetLineItemValue('item', 'quantity', line);
                    	    var description = nlapiGetLineItemValue('item', 'description', line);
                    	    var marketType = nlapiGetLineItemValue('item', 'custcol_market_type', line);
                    	    var item = nlapiGetLineItemValue('item', 'item', line);
                    	    var itemText = nlapiGetLineItemText('item', 'item', line);
                    	    var itemType = nlapiGetLineItemValue('item', 'itemtype', line);
                    	    var serviceDate = nlapiGetFieldValue('custbody_service_date');
                    	    var parentCompany = nlapiGetLineItemValue('item', 'custcol_parent_customer', line);
                    	    var lateFee = nlapiGetLineItemValue('item', 'custcol_late_fee_flag_po', line);
                    	    var clientServicePo = nlapiGetLineItemValue('item', 'custcolcustcol_client_po', line);
                    	    var serviceDocument = nlapiGetLineItemValue('item', 'custcolservice_document', line);
                            var mpInternalId = nlapiGetLineItemValue('item', 'custcol_mp_internal_id', line);//Frank added to test new mp internal Id field on sales order
                          
                        
                    	    LogExecutionAudit('', 'Begin Original Values');
                    	    LogExecutionDebug('', 'soLineToUpdate = ' + soLineToUpdate);
                    	    LogExecutionDebug('', 'changedData = ' + changedData);
                    	    LogExecutionDebug('', 'soNumber = ' + soNumber);
                    	    LogExecutionDebug('', 'close = ' + close);
                    	    LogExecutionDebug('', 'rate = ' + rate);
                    	    LogExecutionDebug('', 'quantity = ' + quantity);
                        	LogExecutionDebug('', 'description = ' + description);
                        	LogExecutionDebug('', 'marketType = ' + marketType);
                        	LogExecutionDebug('', 'customer = ' + customer);
                        	LogExecutionDebug('', 'item = ' + item);
                        	LogExecutionDebug('', 'itemText = ' + itemText);
                        	LogExecutionDebug('', 'itemType = ' + itemType);
                        	LogExecutionDebug('', 'serviceDate = ' + serviceDate);
                        	LogExecutionDebug('', 'parentCompany = ' + parentCompany);
                        	LogExecutionDebug('', 'lateFee = ' + lateFee);
                        	LogExecutionDebug('', 'clientServicePo = ' + clientServicePo);
                        	LogExecutionDebug('', 'serviceDocument = ' + serviceDocument);
                        	LogExecutionAudit('', 'End Original Values');

                        	// Check whether or not there is a change with old records.
                        	if (
                    			(oldLineItemCount >= line &&
                    			   (
                    					oldItems[line - 1] != item || 
                    					oldRates[line - 1] != rate || 
                    					oldQty[line - 1] != quantity || 
                    					oldDesc[line - 1] != description || 
                    					oldClose[line - 1] != close ||
                    					oldClientServicePo[line - 1] != clientServicePo ||
                    					oldServiceDocument[line - 1] != serviceDocument ||
                                  		oldMpInternalId[line - 1] != mpInternalId
	                				)
                				) || 
                				(oldLineItemCount < line)
                        	   ) 
                        	{
                        		changedData = 'true';
                        	}

                        	LogExecutionDebug('', 'changedData = ' + changedData);

                        	if (changedData == 'true')
                        	{
                        		LogExecutionDebug('', 'Data Has changed for line = ' + line);
                        		LogExecutionDebug('', 'serviceDate = ' + serviceDate);

                        		if (!serviceDate || serviceDate == '')
                        		{
                            		LogExecutionDebug('', 'Role = ' + nlapiGetRole());
                                
                            		// Check whether the role is "Pricing Specialist" or not.
                            		if (nlapiGetRole() == '1014' || nlapiGetRole() == 1014)
                            		{
	                                	LogExecutionAudit('', 'Role is 1014');
	                                	LogExecutionDebug('', 'requestDate = ' + requestDate);                           	
                                	
	                                	// Check whether request date is empty or not.
	                                	if (requestDate)
	                                	{
	                                		LogExecutionAudit('', 'Request date has a value. Set service date equal to request date. requestDate = ' + requestDate);
	                                		
	                                		serviceDate = requestDate;
	                                	} else {
	                                		LogExecutionAudit('', 'Request date does NOT have a value. Set service date equal to request date.');                                   	
	                                		LogExecutionError('Cannot Continue Executing Script', 'Please Select Request Date in Purchase Order');                                  	
	                                    	
	                                		// Throwing error manually.
	                                		throw nlapiCreateError('This is created by the \'SIXRED_Populating Lines In So\' user event script.', "Please select Request Date in Purchase Order", true);
	                                	}
                            		 } else {               
                            			 /************************** Creating the Error Files ************************/
                            			 for (var loggen = 1; loggen <= lineItemCount; loggen++)
                            			 {
                            				 LogCustomError(dateString,
	                             			   		    'Role is NOT 1014',
	                             			   		    'Please select service date in purchase order.',
	                             			   		    (loggen == lineItemCount ? true : false),
	                             			   		    nlapiGetLineItemValue('item', 'customer', loggen),
	                             			   		    vendor,
	                             			   		    nlapiGetLineItemValue('item', 'item', loggen),
	                             			   		    nlapiGetLineItemValue('item', 'custcol_parent_customer', loggen));
                            			 }
                            			 /************************** End of Creation of Error Files ******************/
                            		 }
                    			}
                            
                            	LogExecutionDebug('', 'parentCompany = ' + parentCompany);
                            
                            	if (parentCompany == 'National Accounts')
                            	{ 
                            		LogExecutionAudit('', 'Parent Company is National Accounts');
                            		LogExecutionError('Cannot Continue Executing Script (Parent Company is National Accounts)', 'SO UPDATE REQUIRED');

                            		nlapiSetFieldValue('custbody_test_message', '<font size="2.5" color="red"><b>SO UPDATE REQUIRED</b></font>');
                            	} else {
                        			LogExecutionAudit('', 'Parent Company is NOT National Accounts');
                        			
                            		var filterExpression = [
                            			['custrecord1', 'anyof', vendor], // Vendor Location
                                     'and', ['custrecord3', 'anyof', item], // Item
                                     'and', ['isinactive', 'is', 'F'],
                                     'and', ['custrecord6', 'onorbefore', serviceDate], // Service Start
                                     'and', [
                                    	 	['custrecord7', 'onorafter', serviceDate], // Service End
                                         'or', ['custrecord7', 'isempty', null] // Service End
                                     ]
                        			];

                            		// If we have the customer, add it to the master pricing search filter.
                            		if (customer)
                        			{
                            			filterExpression.push('and', ['custrecord2', 'anyof', customer]); // Customer Site
                        			}
                		
                            		var cols = new Array();
                                 cols[cols.length] = new nlobjSearchColumn('custrecord3'); // Item
                                 cols[cols.length] = new nlobjSearchColumn('custrecord_market_type'); // Market Type
                                 cols[cols.length] = new nlobjSearchColumn('custrecord_pricing_method'); // Pricing Method
                                 cols[cols.length] = new nlobjSearchColumn('vendorcostentered', 'custrecord3', null); // Default Item Price for vendor
                                 cols[cols.length] = new nlobjSearchColumn('custrecord4'); // Cost
                                 cols[cols.length] = new nlobjSearchColumn('custrecord5'); // Price
                                 cols[cols.length] = new nlobjSearchColumn('internalid'); // Internal ID Frank added to add the internalId on the item line

         						LogExecutionAudit('', 'Build out the master pricing search filters and columns.');
        						LogExecutionDebug('', 'filterExpression = ' + filterExpression);
        						LogExecutionDebug('', 'cols = ' + cols);
        						LogExecutionDebug('', 'customer = ' + customer);
        						LogExecutionDebug('', 'vendor = ' + vendor);
        						LogExecutionDebug('', 'item = ' + item);
        						LogExecutionDebug('', 'serviceDate = ' + serviceDate);
        						LogExecutionAudit('', 'Search for the master pricing record(s).');
								
                                 var masterPricing = nlapiSearchRecord('customrecordcustom_pricing', null, filterExpression, cols);
                                 var hasMasterPricing = (masterPricing && masterPricing != '' && masterPricing.length > 0);
                                
                                 LogExecutionDebug('', 'masterPricing = ' + masterPricing);
                                 LogExecutionDebug('', 'hasMasterPricing = ' + hasMasterPricing);
                                 LogExecutionAudit('', 'Check for master pricing.');
                                 
                                 if ((hasMasterPricing && masterPricing.length == 1) || (!hasMasterPricing && close == 'T'))
                        		 {
                                	 if (hasMasterPricing && masterPricing.length == 1)
                            		 {
                                		LogExecutionAudit('', 'Master Pricing Record Found');
                                		LogExecutionDebug('', 'Master Pricing Record Count = ' + masterPricing.length);
                                		 
										var marketType = masterPricing[0].getValue(cols[1]);
										var pricingMethod = masterPricing[0].getValue(cols[2]);
										var cost = masterPricing[0].getValue(cols[4]);
										var price = masterPricing[0].getValue(cols[5]);
                                       	var mpid = masterPricing[0].getValue(cols[6]);
											
										LogExecutionDebug('', 'marketType = ' + marketType);
										LogExecutionDebug('', 'pricingMethod = ' + pricingMethod);
										LogExecutionDebug('', 'cost = ' + cost);
										LogExecutionDebug('', 'price = ' + price);
                                        LogExecutionDebug('', 'mpid = ' + mpid);
                            		 }
                                	 else
                                		LogExecutionAudit('', 'No Master Pricing Record Found But Close = \'T\'');
                                	 	
                                	 LogExecutionDebug('', 'soNumber = ' + soNumber);
                                	 LogExecutionAudit('', 'Check if the sales order number exists or not. If so, modify the existing line item otherwise create a new one.');
                                	 	
                                	 // Check whether it is an existing line item (has \'custcol_soline_no\') or a new one.
                            		if (soNumber != null && soNumber != '')
                            		{
                            			LogExecutionAudit('', 'SO Number Exists');
                            				
										var soLine = soNumber.toString().split('-')[1];
										
										LogExecutionAudit('', 'Check if we have an SO line.');
										LogExecutionDebug('', 'soLine = ' + soLine);

                                		if (soLine)
                            			{
                                			LogExecutionAudit('', 'Found the SO line.');
                                			LogExecutionDebug('', 'Is Closed - close = ' + close);
                                			
                                			if (close == 'F' || close == '')
                                    		{
                                				LogExecutionAudit('', 'Not Closed.');

                                    			salesOrder.setLineItemValue('item', 'isclosed', soLine, 'F');
                                    			
                                    			LogExecutionDebug('', 'line = ' + line);
                                    			LogExecutionDebug('', 'oldRates[line - 1] = ' + oldRates[line - 1]);
                                    			LogExecutionDebug('', 'rate = ' + rate);

                                    			// Check if the rate has changed, market type is 'open', and pricing method is 'contracted rate'. 
                                    			if (
                                					oldRates[line - 1] != rate
                                					&&
                                					(
                        							 marketType == '1' || 
                        							 marketType == 1
                        							) 
                        							&&
                        							(
                									 pricingMethod == '2' || 
                									 pricingMethod == 2
                									)
                								   )
                                				{
                                    				LogCustomError(dateString,
                                            			   		   'Cannot Adjust Rate',
                                            			   		   ('The rate cannot be changed for an item which has market type as \'open\' and pricing method as \'contracted rate\'. Item \'' + itemText + '\' in line ' + line + '.'),
                                            			   		   true,
                                            			   		   customer,
                                            			   		   vendor,
                                            			   		   item,
                                            			   		   parentCompany);
                                				}

                                    			if (
                                					pricingMethod == '2' ||
                                					pricingMethod == 2 ||
                                					pricingMethod == '3' ||
                                					pricingMethod == 3 ||
                                                    pricingMethod == '4' || //testing new pricing method
                                					pricingMethod == 4 //testing new pricing method
                                				   )
                                				{
                                    				LogExecutionAudit('', 'Update description, quantity, client service po, and service document on the sales order.');
                                    				LogExecutionDebug('', 'description = ' + description);
                                    				LogExecutionDebug('', 'quantity = ' + quantity);
                                    				LogExecutionDebug('', 'clientServicePo = ' + clientServicePo);
                                    				LogExecutionDebug('', 'serviceDocument = ' + serviceDocument);
                                    				
                                    				salesOrder.setLineItemValue('item', 'description', soLine, description);
                            						salesOrder.setLineItemValue('item', 'quantity', soLine, quantity);
                            						salesOrder.setLineItemValue('item', 'custcolcustcol_client_po', soLine, clientServicePo);
                            						salesOrder.setLineItemValue('item', 'custcolservice_document', soLine, serviceDocument);
                                                    salesOrder.setLineItemValue('item', 'custcol_mp_internal_id', soLine, mpInternalId);//Frank added to test adding the mp internal id to the sales order
                                				}

                                    			if (pricingMethod == '3' || pricingMethod == 3)
	                                				{
                                    				LogExecutionDebug('', 'rate = ' + rate);

        	                                			if (rate === null || rate === '')
                                        			{
                                                		LogExecutionAudit('', 'No rate so set it to 0.');
                                                	
                                                		rate = parseFloat("0");
                                                		
                                            			LogExecutionDebug('', 'rate (after parse) = ' + rate);
                                        			}            
        	                                			
        	                                			LogExecutionAudit('', 'Update rate on the sales order.');

        	                                			salesOrder.setLineItemValue('item', 'rate', soLine, rate);
        	                                			salesOrder.setLineItemValue('item', 'item', soLine, item);
	                                				}

                        						nlapiSetLineItemValue('item', 'custcol_market_type', line, marketType);
                        						nlapiSetLineItemValue('item', 'custcol_pricing_method', line, pricingMethod);
                                    		} else if (close == 'T') {
                                    			LogExecutionAudit('', 'Closed.');
                                    			
                                	    		salesOrder.setLineItemValue('item', 'isclosed', soLine, 'T');
                                    		}                          			
                            			} else {
                    						LogCustomError(dateString,
                               			   		   'Sales Order Line Does NOT Exist',
                               			   		   ('Sales order line does not exist for an item \'' + itemText + '\' in line ' + line + '.'),
                               			   		   true,
                               			   		   customer,
                               			   		   vendor,
                               			   		   item,
                               			   		   parentCompany);                           				
                            			}
                        			} else if (hasMasterPricing) {
                        				LogExecutionAudit('', 'Sales order line item not found. Create a new line item.');
                        				
                        				soLineToUpdate = (saleOrderLineItemCount + 1);
                                    
                    					if (
                							pricingMethod == '1' || 
                							pricingMethod == 1 || 
                							pricingMethod == '2' || 
                							pricingMethod == 2 || 
                							pricingMethod == '3' || 
                							pricingMethod == 3 ||
											pricingMethod == '4' || //testing new pricing method
											pricingMethod == 4 //Test new pricing method
                						   )
                						{
                            				LogExecutionDebug('', 'lateFee = ' + lateFee);
                            				LogExecutionAudit('', 'Check if the line item has a late fee (custcol_late_fee_flag_po).');	
                    						
                        					if (
                    							(
                        						 pricingMethod == '2' || 
                        						 pricingMethod == 2 || 
                        						 pricingMethod == '3' || 
                        						 pricingMethod == 3 ||
                                                 pricingMethod == '4' || //Frank Testing pricing method add
                                                 pricingMethod == 4       //Frank Testing pricing method add
                    							) &&
                    							lateFee != 'T'
                    						   )
                    						{
                        						LogExecutionAudit('', 'There is NO late fee.');
                    	    					LogExecutionAudit('', 'Add Line Item and Update PO.');
                    	    					LogExecutionDebug('', 'saleOrderLineItemCount = ' + saleOrderLineItemCount);
                    	    					LogExecutionDebug('', 'soLineToUpdate = ' + soLineToUpdate);
                    	    					
                    	    					salesOrder.setLineItemValue('item', 'description', soLineToUpdate, description);
                                            	salesOrder.setLineItemValue('item', 'quantity', soLineToUpdate, quantity);
                                            	salesOrder.setLineItemValue('item', 'item', soLineToUpdate, item);
                                            	salesOrder.setLineItemValue('item', 'custcolcustcol_client_po', soLineToUpdate, clientServicePo);
                                            	salesOrder.setLineItemValue('item', 'custcolservice_document', soLineToUpdate, serviceDocument);
                                                salesOrder.setLineItemValue('item', 'custcol_mp_internal_id', soLineToUpdate, mpInternalId);//Frank added to try update mpinternal id on sales order
                                            	salesOrder.setLineItemValue('item', 'custcol_soline_no', soLineToUpdate, salesOrderId + '-' + parseInt(soLineToUpdate));

                                            	LogExecutionAudit('', 'Add the line item rate if we can.');

                                            	// Add rate / price to the line item rate.
                        	    				if (pricingMethod == '3' || pricingMethod == 3)
                        	    				{
                        	    					LogExecutionAudit('', 'Adding rate to the line item rate.');
                        	    					
                        	    					salesOrder.setLineItemValue('item', 'rate', soLineToUpdate, rate);
                        	    				} else if ((pricingMethod == '2' || pricingMethod == 2 || pricingMethod == '4' || pricingMethod == 4 ) && price) { //adding pricing method 4 testing new frank
                        	    					LogExecutionAudit('', 'Adding price to the line item rate.');
                        	    					
                        	    					salesOrder.setLineItemValue('item', 'rate', soLineToUpdate, price);
                        	    				} else {
                        	    					LogExecutionAudit('', 'Rate was NOT added to the line item.');
                        	    				}
                        	    				
                        	    				nlapiSetLineItemValue('item', 'custcol_soline_no', line, salesOrderId + '-' + parseInt(soLineToUpdate));
                        	    				
                        	    				// Since we are adding a new sales order line item we need to increment the overall count.
                        	    				saleOrderLineItemCount++;
                    						}

                                        	nlapiSetLineItemValue('item', 'custcol_market_type', line, marketType);
                                        	nlapiSetLineItemValue('item', 'custcol_pricing_method', line, pricingMethod);
                                        	
                                        	LogExecutionAudit('', 'Check if we have cost. If so, add it to the line item.');
                                        	
                                        	// Check if we have cost. If so, add it to the line item.
                                        	if (cost)
                                        	{
                                        		LogExecutionAudit('', 'We have cost. Add it to the line item.');
                                        		
                                        		nlapiSetLineItemValue('item', 'custcol_original_rate_item', line, cost);
                                        	}
                						} else {
                                    	 	LogCustomError(dateString,
     	                          			   		   'Pricing Method',
     	                          			   		   ('Cannot add item \'' + itemText + '\' in line ' + line + ' due to the pricing method. pricingMethod = ' + pricingMethod),
     	                          			   		   true,
     	                          			   		   customer,
     	                          			   		   vendor,
     	                          			   		   item,
     	                          			   		   parentCompany);
                						}
                        			} else {
                                		LogExecutionAudit('', 'No Master Pricing Records Found and Existing Item Not Closed');
                                	 	LogCustomError(dateString,
	                          			   		   'No Master Pricing Records Found and Item Not Closed',
	                          			   		   ('No master pricing record found for an item \'' + itemText + '\' in line ' + line + ' and existing item not closed.'),
	                          			   		   true,
	                          			   		   customer,
	                          			   		   vendor,
	                          			   		   item,
	                          			   		   parentCompany);                            				
                        			}
                            	} else if (hasMasterPricing && masterPricing.length > 1) {
                            		LogExecutionAudit('', 'Multiple Master Pricing Records Found');
                            	 	LogExecutionDebug('', 'Master Pricing Record Count = ' + masterPricing.length);
                            		LogCustomError(dateString,
                         			   		   'Found More Than One Master Pricing Record',
                         			   		   ('Found multiple master pricing records for an item \'' + itemText + '\' in line ' + line + '.'),
                         			   		   true,
                         			   		   customer,
                         			   		   vendor,
                         			   		   item,
                         			   		   parentCompany);
                            	} else if (lateFee != 'T') {
                            		LogExecutionAudit('', 'No Master Pricing Records Found and Existing Item Not Closed');
                            	 	LogCustomError(dateString,
                          			   		   'No Master Pricing Records Found and Item Not Closed',
                          			   		   ('No master pricing record found for an item \'' + itemText + '\' in line ' + line + ' and existing item not closed.'),
                          			   		   true,
                          			   		   customer,
                          			   		   vendor,
                          			   		   item,
                          			   		   parentCompany);
                            	}
                                 
             					LogExecutionAudit('', 'Check if item type is \'NonInvtPart\'');
            					
            					if (itemType == "NonInvtPart")
            					{
            						LogExecutionAudit('', 'Item type IS \'NonInvtPart\'');
            						LogExecutionAudit('', 'Load Item Record');
            						
            						var itemRecord = nlapiLoadRecord('noninventoryitem', item);
            						var incomeAccount = itemRecord.getFieldValue('incomeaccount');
            						var expenseAccount = itemRecord.getFieldValue('expenseaccount');
            						
            						LogExecutionDebug('', 'incomeAccount = ' + incomeAccount);
            						LogExecutionDebug('', 'expenseAccount = ' + expenseAccount);
            						LogExecutionDebug('', 'line = ' + line);
            						LogExecutionDebug('', 'soLineToUpdate = ' + soLineToUpdate);
            						LogExecutionAudit('', 'Set Account Number');

            						salesOrder.setLineItemValue('item', 'custcol_account_number', soLineToUpdate, incomeAccount);
            						nlapiSetLineItemValue('item', 'custcol_account_number', line, expenseAccount);
            					}
                        	}
                    	}
                	}

                    try
                    {
                    	    LogExecutionDebug('', 'context = ' + context);
                    	    LogExecutionDebug('', 'nlapiGetFieldValue(\'custbody_ba_flag_update\') = ' + nlapiGetFieldValue('custbody_ba_flag_update'));
                    	    LogExecutionAudit('', 'Check if the context is \'scheduled\' and custbody_ba_flag_update is \'T\'.');
	                    	
                        if (context == 'scheduled' && nlapiGetFieldValue('custbody_ba_flag_update') == 'T')
                        {
                        		LogExecutionAudit('', 'Context is \'scheduled\' and custbody_ba_flag_update is \'T\'.');                       
                    	        
                        		var date = new Date();

                	            	LogExecutionAudit('', 'Update the SO custbody_so_process_info to ' + date + '.');
                            
                	            	salesOrder.setFieldValue('custbody_so_process_info', "Updated On " + date);
                        }

                        LogExecutionAudit('', 'Save the SO.');
                        
                        nlapiSubmitRecord(salesOrder, true, true);
                        
                        LogExecutionAudit('', 'Update the PO custbody_ba_flag_update to \'F\'.');
                        
                        nlapiSetFieldValue('custbody_ba_flag_update', 'F');
                    } catch (e) {
                    		LogExecutionError('Issue(s) In Executing The Script (Could Not Submit SO Record ' + salesOrderId + ' and Update PO Field). Return.', e);
                    	    
                        return;
                    }
        			}
        		}
    		}
    	}

    LogExecutionAudit('End \'SIXRED_Populating Lines In So\' User Event Script', 'populatingLinesInSO');
}

function after()
{
	LogExecutionAudit('Begin Function in \'SIXRED_Populating Lines In So\' User Event Script', 'after');
	
    var context = nlapiGetContext().getExecutionContext();
    
    LogExecutionDebug('', 'context (after submit) = ' + context);
    
    if (context == 'userinterface' || context == 'scheduled')
    	{
    		LogExecutionAudit('', 'Hai');
    	}
    
    LogExecutionAudit('End Function in \'SIXRED_Populating Lines In So\' User Event Script', 'after');
}

function LogCustomError(date, errorTitle, errorMessage, throwError, customer, vendor, item, parentCompany)
{
	LogExecutionDebug('', 'date = ' + date);
	LogExecutionDebug('', 'errorTitle = ' + errorTitle);
	LogExecutionDebug('', 'errorMessage = ' + errorMessage);
	LogExecutionDebug('', 'throwError = ' + throwError);
	LogExecutionDebug('', 'customer = ' + customer);
	LogExecutionDebug('', 'vendor = ' + vendor);
	LogExecutionDebug('', 'item = ' + item);
	LogExecutionDebug('', 'parentCompany = ' + parentCompany);

	var errorfilters = new Array();
	var errorCols = new Array();
 
	errorfilters[0] = new nlobjSearchFilter('custrecord_expection_date', null, 'on', 'today');
	errorfilters[1] = new nlobjSearchFilter('custrecord_po_number_', null, 'anyof', nlapiGetRecordId());
	errorfilters[2] = new nlobjSearchFilter('custrecord_customer_location', null, 'anyof', customer);
	errorfilters[3] = new nlobjSearchFilter('custrecord9', null, 'anyof', vendor); // Vendor 
	errorfilters[4] = new nlobjSearchFilter('custrecord_item_on_po', null, 'anyof', item);

	if (parentCompany)
	{
 		errorfilters[5] = new nlobjSearchFilter('custrecord_parent_customer_line', null, 'is', parentCompany);
	} else {
		errorfilters[5] = new nlobjSearchFilter('custrecord_parent_customer_line', null, 'isempty');
	}

	errorCols[0] = new nlobjSearchColumn('custrecord_error_description');
 
	var errorSearch = nlapiSearchRecord('customrecord_er1_exception_details_po', null, errorfilters, errorCols);
 
	LogExecutionAudit('', 'Search custom exception records (customrecord_er1_exception_details_po).');
	LogExecutionDebug('', 'errorSearch = ' + errorSearch);

	if (errorSearch)
	{
		LogExecutionAudit('', 'Found error log record.');

		var errorDesc = errorSearch[0].getValue(errorCols[0]);
     
 		LogExecutionDebug('', 'Error Details - errorDesc = ' + errorDesc);
     
 		if (errorDesc) 
 		{
 			errorDesc += '\n' + errorMessage;
 		} else {
 			errorDesc = errorMessage;
 		}
 		
     	LogExecutionDebug('', 'errorDesc (updated) = ' + errorDesc);
     
     	try
     	{
     	   	LogExecutionAudit('', 'Update error log record.');
     	
     	   	nlapiSubmitField(errorSearch[0].getRecordType(), errorSearch[0].getId(), 'custrecord_error_description', errorDesc);
     	} catch (e) {
     		LogExecutionError('Issue(s) In Executing The Script (Error Log Update)', e);
     	}
	} else {
	   	LogExecutionAudit('', 'Did NOT find error log record.');
 	
	   	var errorRec = nlapiCreateRecord('customrecord_er1_exception_details_po', 
		{
	   		recordmode: 'dynamic'
	   	});
     
	   	errorRec.setFieldValue('custrecord_expection_date', date);
	   	errorRec.setFieldValue('custrecord_po_number_', nlapiGetRecordId());
	   	errorRec.setFieldValue('custrecord_customer_location', customer);
	   	errorRec.setFieldValue('custrecord9', vendor);
	   	errorRec.setFieldValue('custrecord_item_on_po', item);
	   	errorRec.setFieldValue('custrecord_parent_customer_line', parentCompany);
	   	errorRec.setFieldValue('custrecord_error_description', errorMessage);
     
	   	try
     	{
	   		LogExecutionAudit('', 'Create error log record.');
     	
	   		nlapiSubmitRecord(errorRec, true, true);
     	} catch (e) {
     		LogExecutionError('Issue(s) In Executing The Script (Error Log Insert)', e);
     	}
 	}

	LogExecutionError('Cannot Continue Executing Script (Create Log Record)', errorMessage);

 	if (throwError)
	{
 		throw nlapiCreateError('This is created by the \'SIXRED_Populating Lines In So\' user event script.', errorMessage, true);
	}
}

function LogExecution(logType, subject, details)
{
	if (!logType)
	{
		logType = 'DEBUG';
	}

	if (!subject)
	{
		subject = 'Request';
	}

	nlapiLogExecution(logType, subject, details);
}

function LogExecutionDebug(subject, details)
{
	LogExecution('DEBUG', subject, details);
}

function LogExecutionAudit(subject, details)
{
	LogExecution('AUDIT', subject, details);
}

function LogExecutionError(subject, details)
{
	LogExecution('ERROR', subject, details);
}