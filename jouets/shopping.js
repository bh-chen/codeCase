function handleRequest(session, request, response, params){
	if (request.method == "GET") {	    
	    var site = context.site.first,
	    	currency = 'EUR';
	    	
		if (site) {
			currency = site.currency || currency;
		}
			
		var orderResult = {
	        TVA:			TVA,
	        success:		true,
	        items:			[],
	        subtotal:		0,
	        total:			0,
	        discount:		0,
	        shippingMethod: rdShippingMethod ? rdShippingMethod.name: '',
	        shipping:		rdShippingMethod ? rdShippingMethod.cost || 0 : 0,
	        currency:		currency
	        // promotion:		{}
	    }
	    
	    for (let v in cart) {
	    	let product;
	    	let item = cart[v];
			product = getProductDetail(v, item);
	    	
	    	if (product) {
	    		orderResult.total += ( product.total || 0);
				product.discount = 0;
	        	orderResult.items.push(product);
	    	}
	    }
	    
	    orderResult.subtotal = orderResult.total;
	    
	    // Apply promotion code
	    var rdPromotion = checkPromotionCode(data.promotionCode);
	    var orderTVA = TVA;
	    
	    if (rdPromotion && rdPromotion.allProduct && rdPromotion.minAmount <= orderResult.subtotal) {
	    	orderResult.promotion = {
	    		promoCode:			rdPromotion.code,
	    		name:				rdPromotion.name,
	    		desc:				rdPromotion.description,
	    		promotionType:		rdPromotion.promotionType,
	    		promotionTypeName:	promotionTypes[rdPromotion.promotionType].name,
	    		minAmount:			rdPromotion.minAmount || 0,
	    		discountType:		rdPromotion.discountType,
	    		free:				rdPromotion.free,
	    		value:				rdPromotion.value
	    	}
	    	
	    	if (rdPromotion.promotionType == promotionTypes.cart_discount.code) {
	    		if (rdPromotion.discountType == '%') {
	        		orderResult.items.forEach((product) => {
		        		let discount = (product.price * rdPromotion.value) / 100;
	        			product.discount = round(discount);
	        			product.price = product.price - discount;
	        			product.total = product.price * product.qty;
	        			
	        			orderResult.discount += product.discount * product.qty;
		        	});
	        	} else {
	        		// divided equally for all products
	        		let discountTotal = rdPromotion.value;
	        		orderResult.items.forEach((product) => {
	        			let discount = 0;
	        			if (rdPromotion.value < orderResult.total) {
		        			if (discountTotal >= product.total) {
		        				discountTotal = discountTotal - product.total;
		        				discount = product.total/product.qty;
		        			} else {
		        				discount = discountTotal/product.qty;
		        				discountTotal = 0;
		        			}
	        			} else {
	        				discount = product.price;
	        			}
		        		
	        			product.discount = discount;
	        			product.price = product.price - discount;
	        			product.total = product.price * product.qty;
	        			orderResult.discount += discount * product.qty;
		        	});
	        	}
	        	
	        	orderResult.total = orderResult.total - orderResult.discount;
	    	} else if (rdPromotion.promotionType == promotionTypes.tax_discount.code) {
	    		var totalTAX = orderResult.total * TVA;
	    		
	    		// Free tax, TVA = 0%
	    		if (rdPromotion.free) {
	    			orderTVA = 0;
	    			orderResult.discount += totalTAX;
	    		} else {
	    			// % discount for the tax  (e.g.  10% Tax discount ) 
	    			if (rdPromotion.discountType == '%') {
	    				var taxDiscount = ((rdPromotion.value / 100) * TVA );
	    				
	        			orderTVA = TVA - taxDiscount;
	        			orderResult.discount += orderResult.total * taxDiscount;
	    			
	    			// Flat amount adjustment  (e.g. Tax have $5 adjustment )
	        		} else {
	        			// if Tax adjustment > total tax
	        			if (rdPromotion.value > totalTAX) {
	        				orderTVA = 0;
	    					orderResult.discount += totalTAX;
	        			} else {
	        				var taxDiscount = rdPromotion.value * 100 / totalTAX; // tax discount in percent(%)
	        				
	        				taxDiscount = ((taxDiscount / 100) * TVA );
	        				orderTVA = TVA - taxDiscount;
	        				orderResult.discount += rdPromotion.value;
	        			}
	        		}
	    		}
	    	} else if (rdShippingMethod && rdPromotion.promotionType == promotionTypes.shipping_discount.code && orderResult.shipping > 0) {
	    		// free shipping
	    		let discount = 0;
	    		
	    		if (rdPromotion.free) {
	    			discount = orderResult.shipping;
	    			orderResult.shipping = 0;
	    		} else {
	    			// discount shipping by %
					if (rdPromotion.discountType == '%') {
	        			discount = (orderResult.shipping * rdPromotion.value) / 100;
	        			
	    			// discount shipping by amount
	        		} else {
	        			if (rdPromotion.value > orderResult.shipping) {
	        				discount = orderResult.shipping;
	        			} else {
	        				discount = rdPromotion.value;
	        			}
	        		}
	        		orderResult.shipping = orderResult.shipping - discount;
	    		}
	    		
	    		orderResult.discount += round(discount);
	    	}
	    }
	    
	    // Apply tax
		let totalTVA = 0;
		
		orderResult.total = 0;
	    orderResult.items.forEach((product) => {
	    	let proVat = product.price * orderTVA;
	    	
	    	totalTVA += round(proVat) * product.qty;
			
			product.price = product.price + proVat;
			product.price = round(product.price);
			product.total = round(product.price * product.qty);
			
			orderResult.total = (orderResult.total * 10 + product.total * 10) / 10;
	    });
	    
	    orderResult.discount = round(orderResult.discount);
	    orderResult.subtotal = round(orderResult.subtotal);
	    orderResult.total = orderResult.total + orderResult.shipping;
	    orderResult.total = round(orderResult.total);
	    orderResult.TVA = round(totalTVA);
	    return response.end(orderResult);
	} else {
		response.end({success: false});
	}
    
    
    //***************************************************************************************************	
	//Get Cart Detail 
	//***************************************************************************************************	
	function getProductDetail(product_guid, cartItem) {
		var rtn = {
			price: 0,
			special_price: 0,
			guid: product_guid,
			qty: cartItem.qty,
			unitPrice: 0,
			total: 0
		};
		var attribute_list = '("display_name","price_retail","price_special")';
		
		/*
		rtn["name"]				 = "";		//Product Name 
		rtn["description"]		 = "";		//Product Description (default)
		rtn["desc_extra"]		 = "";		//Product Descripiont Extra
		rtn["age_range"]		 = "";		//Product Age range
		rtn["learn_more"]		 = "";		//Product Learn More 
		rtn["battery"]			 = [];		//Product Battery
		rtn["warning"]			 = [];		//Prodcut Warning
		rtn["videos"]			 = "";		//Product Videos
		rtn["videos_img"]		 = "";		//Product Videos Image
		rtn["price"]			 = "";		//Product Price (Retail)
		rtn["special_price"]	 = "";		//Prdouct Price (Special)
		rtn["stock"]			 = 1;		//Product Stock - 0:no stock; 1:stock availiable; Default:0; [TODO]
		rtn["promo_title"]		 = "";		//Product Poromotion Title
		rtn["promo_banner"]		 = "";		//Product Banner
		rtn["promo_banner_url"]	 = [];		//Product Banner link
		rtn["model_title"]		 = [];		//Product Model Title
		rtn["model_url"]		 = [];		//Product Model Url		
		rtn["edu_con_icon"]		 = [];		//Product Education Contributions Icon
		rtn["edu_con_desc"]		 = [];		//Product Education Contributions Description
		rtn["award_badges_icon"] = "";		//Product Award Icon
		rtn["award_badges_url"]	 = "";		//Product Award Url
		rtn["images"]			 = [];		//Product Image
		rtn["id"]				 = "";		//Product Id
		rtn["max_quantity"]		 = 10;					//Product Max Quantity
		rtn["guid"]	= product_guid;		//Product guid
		rtn["qty"]	= cartItem.qty;		//Cart Quantity
		*/
		
		var strSQL	
			= "select attribute_code, attribute_datatype, attribute_values1, attribute_values2, attribute_guid, attribute_value_guid "
			+ "  from pim_product_attribute_values_v "
			+ "  where product_guid=? "
			+ "   and pm_bu_code=? "
			+ "   and attribute_code in " + attribute_list
			+ " order by attribute_code, row_seq ";
		
		var details = context.execSQL(strSQL, [product_guid,bu_code]);
		
		if (details && details.length > 0) {
			for (var i=0; i<details.length; i++) {
				var detail = details[i];
				var value = getLangValue(detail["attribute_values1"],lang);
				var value2 = getLangValue(detail["attribute_values2"],lang);
				
				switch(detail["attribute_code"]) { 
	
					//Display name
					case "display_name": { 
						rtn["name"]=value;
						break; 
					} 
	
					//Retail Price
					case "price_retail": { 
						rtn["price"]= parseFloat(value); // round(value);
						break; 
					} 		
					
					//Special Price
					case "price_special": { 
						rtn["special_price"]= parseFloat(value); //round(value);
						break; 
					} 	
				}
				
				var price = rtn.special_price || rtn.price || 0;
				
				rtn.price = price;
				rtn.unitPrice = price;
				rtn.total = rtn.price * rtn["qty"];
			}
		}
		
		// strSQL
		// = "	select guid, product_number "
		// + "	from pim_product_master a "
		// + " where exists (select 1 from pim_product_attribute_values_v b where a.guid=b.product_guid and b.attribute_code='web_active' and b.attribute_values1=1) "
		// + " and ifnull(deleted, 0)=0"
		// + " and guid=?"
		// + " and bu_code=?";
		
		// var products = context.execSQL(strSQL, [product_guid,bu_code]);
	
		// if (products && products.length > 0) {
		// 	rtn["id"]=products[0]['product_number'];		//Product Id
		// }
		
		return rtn;
	}
	
	
	//***************************************************************************************************	
	// Check Promotion Code
	//***************************************************************************************************	
	function checkPromotionCode(promoCode) {
		if (!promoCode) return null;
		context.productPromotion.reset();
		context.productPromotion.query.where.code.equal(promoCode);
		context.productPromotion.orderBy.modifyDate.desc;
		context.productPromotion.fetchRecords();
		
		var rd = context.productPromotion.first;
		var currDate = new Date();
		// return valid promotion code
		if (rd && !rd.disabled && (rd.activation || 0) < (rd.maxActivation == undefined ? 1000000: rd.maxActivation) 
			&& (!rd.startDate || rd.startDate <= currDate) && (!rd.endDate || rd.endDate >= currDate)) {
			return rd;
		// invalid promotion code
		} else {
			return null;
		}
	}
}












/*

cart pim

*/

function handleRequest2(session, request, response, params) {
	var lang = "fr";//session.lang.code;
	var result = [];
	var bu_code = "vtefr";
	var bu_languages = [];
	var target = "cart"
	var context;
	var strSQL = "";
	// var lib_productDetail = new product_detail.TProduct_detail(session, request);
   
	// var product_guid = '8881ea52-a884-475e-f1a8-b981b8761a62';
	var product_guid=[];
	// var productDetail_result;
	 
	// productDetail_result = lib_productDetail.get_product_detail(guid, context, 'cart');
	
	//***************************************************************************************************	
	//Get Product Detail
	//***************************************************************************************************	
	try {
        var cart = JSON.parse(request.cookies['cart_items'] || null);
    } catch (e) {
        var cart = null;
    }
    if (!cart) {
    	return response.end({
            success: false,
            error: '$empty_cart'
        });
    }
    for (let v in cart) {
    	let product;
    	let item = cart[v];
		product = get_cart_detail(v, item);
    	if (!product) {
    		continue;
    	}
    	
    	// result.total = result.total + product.total;
     //   result.subtotal = result.total;
    	product_guid.push(v);
        result.push(product);
    }
	var productDetail_result = {
			"success": 'false',
			"max_quantity_cart": 30,
			"type": "",
			"data": {}				
	};
	
	//Check Product Active
	// var active = check_product_active(product_guid, context);
	//***************************************************************************************************		
	// Check product active
	//***************************************************************************************************	
	var active = {
				"success" : false,
				"product_number" : ""
	};
	strSQL
		= "	select guid, product_number "
		+ "	from pim_product_master a "
		+ " where exists (select 1 from pim_product_attribute_values_v b where a.guid=b.product_guid and b.attribute_code='web_active' and b.attribute_values1=1) "
		+ " and ifnull(deleted, 0)=0"
		+ " and guid in (\"" + product_guid.join('\",\"') +"\")"
		+ " and bu_code=?";
	
	var products = context.execSQL(strSQL, [bu_code]);
	
	if (products && products.length > 0) {
		active["success"] = true;	
		// active["product_number"] = products[0]['product_number'];
	}
		
	if(active.success){

		// get available languages
		strSQL = "select language_code,language_name from pim_bu_language where bu_code=?";
		var languages = context.execSQL(strSQL, [bu_code]);
		if (languages && languages.length > 0) {
			var bu_without_english = true;
	
			for (var i=0; i<languages.length; i++) {
				var language = languages[i];
	
				bu_languages.push({
					"code": language.language_code,
					"name": language.language_name
				});
	
				if ((bu_without_english) && (language.language_code == "en")) {
					bu_without_english = false;
				}
			}
	
			if (bu_without_english) {
				bu_languages.push({
					"code": "en",
					"name": "English"
				});
			}
		}
	
		//Select Target
		switch(target) { 

			//Cart page
			case "cart": { 
				productDetail_result["success"] = 'true';
				productDetail_result["type"] = target;
				productDetail_result["max_quantity_cart"] = 30;
				productDetail_result["data"] = result;
				// productDetail_result["data"]["id"] = active.product_number;
				// productDetail_result["data"]["guid"] = product_guid;
				break; 
			} 
			
			//[todo] Prdouct detial page
			case "product_detial": { 
				productDetail_result["success"] = 'true';
				productDetail_result["type"] = target;
				productDetail_result["max_quantity_cart"] = 30;
				productDetail_result["data"] = [] 
				break; 
			} 
			
		}
		
	}

	//***************************************************************************************************	
	//[todo] Get Product Attachment
	//***************************************************************************************************	
	function get_product_attachment(){}
	
	
	
	
	//***************************************************************************************************	
	//[todo] Get Product Stock
	//***************************************************************************************************	
	function get_product_stock(){}
	
	//***************************************************************************************************	
	//Get Cart Detail 
	//***************************************************************************************************	
	function get_cart_detail(product_guid, cartItem){
		
		var rtn = {};
		var attribute_list = '("display_name","price_retail","price_special")';
		
		// rtn=get_product_attribute_vale(product_guid, attribute_list);
		
		rtn["name"]				 = "";		//Product Name 
		rtn["description"]		 = "";		//Product Description (default)
		rtn["desc_extra"]		 = "";		//Product Descripiont Extra
		rtn["age_range"]		 = "";		//Product Age range
		rtn["learn_more"]		 = "";		//Product Learn More 
		rtn["battery"]			 = [];		//Product Battery
		rtn["warning"]			 = [];		//Prodcut Warning
		rtn["videos"]			 = "";		//Product Videos
		rtn["videos_img"]		 = "";		//Product Videos Image
		rtn["price"]			 = "";		//Product Price (Retail)
		rtn["special_price"]	 = "";		//Prdouct Price (Special)
		rtn["stock"]			 = 1;		//Product Stock - 0:no stock; 1:stock availiable; Default:0; [TODO]
		rtn["promo_title"]		 = "";		//Product Poromotion Title
		rtn["promo_banner"]		 = "";		//Product Banner
		rtn["promo_banner_url"]	 = [];		//Product Banner link
		rtn["model_title"]		 = [];		//Product Model Title
		rtn["model_url"]		 = [];		//Product Model Url		
		rtn["edu_con_icon"]		 = [];		//Product Education Contributions Icon
		rtn["edu_con_desc"]		 = [];		//Product Education Contributions Description
		rtn["award_badges_icon"] = "";		//Product Award Icon
		rtn["award_badges_url"]	 = "";		//Product Award Url
		rtn["images"]			 = [];		//Product Image
		rtn["id"]				 = "";		//Product Id
		rtn["guid"]			 	 = product_guid;		//Product guid
		rtn["quantity"]			 = cartItem.qty;		//Product Max Quantity
		rtn["max_quantity"]		 = 10;		//Product Max Quantity
		strSQL	
			= "select attribute_code, attribute_datatype, attribute_values1, attribute_values2, attribute_guid, attribute_value_guid "
			+ "  from pim_product_attribute_values_v "
			+ "  where product_guid=? "
			+ "   and pm_bu_code=? "
			+ "   and attribute_code in " + attribute_list
			+ " order by attribute_code, row_seq ";
		
		var details = context.execSQL(strSQL, [product_guid,bu_code]);
		
		
		
		if (details && details.length > 0) {
			for (var i=0; i<details.length; i++) {
				var detail = details[i];
				var value = getLangValue(detail["attribute_values1"],lang);
				var value2 = getLangValue(detail["attribute_values2"],lang);
				
				switch(detail["attribute_code"]) { 

					//Display name
					case "display_name": { 
						rtn["name"]=value;
						break; 
					} 

					//Description
					case "desc": { 
						rtn["description"]=value;
						break; 
					} 
					
					//Description Extra
					case "desc_extra": { 
						rtn["desc_extra"]=value;
						break; 
					} 
					
					//Age Range
					case "age_range": { 
						rtn["age_range"]={"from":parseInt(value),"to":parseInt(value2)};
						break; 
					} 

					//Learn More 
					case "learn_more_desc": { 
						rtn["learn_more"]=value;
						break; 
					} 	
					
					//Battery
					case "battery": { 
						rtn["battery"].push({value});
						break; 
					} 						
					
					//Warring
					case "warning": { 
						rtn["warning"].push({value});
						break; 
					} 	
					
					//Video
					case "video_link": { 
						rtn["videos"]=value;
						break; 
					} 	
					
					//Video Img
					case "video_img": { 
						rtn["videos_img"]=value;
						break; 
					} 

					//Retail Price
					case "price_retail": { 
						rtn["price"]=round(value);
						break; 
					} 		
					
					//Special Price
					case "price_special": { 
						rtn["special_price"]=round(value);
						break; 
					} 	
					
					//Educational Contributions Icon
					case "edu_con_icon":{
						rtn["edu_con_icon"].push({"file":value});
						break;
					}
					
					//Educational Contributions Description
					case "edu_con_desc":{
						rtn["edu_con_desc"].push({value});
						break;
					}
					
					//Award Icon
					case "award_badges_img":{
						rtn["award_badges_icon"]=value;
						break;
					}
					
					//Award Url
					case "award_badges_url":{
						rtn["award_badges_url"]=value;
						break;
					}			
					
					//Banner Image
					case "banner_img":{
						rtn["promo_banner"]=value;
						break;
					}
					
					//Banner Url
					case "banner_url":{
						rtn["promo_banner_url"].push({value});
						break;
					}
					
					//Model Title
					case "model_title":{
						rtn["model_title"].push({value});
						break;
					}
					
					//Model Url
					case "model_link":{
						rtn["model_url"].push({value});
						break;
					}
					
					//Promo Title
					case "promo_title":{
						rtn["promo_title"]=value;
						break;
					}
					
					
				} 
				
			}
		}
		
		// rtn["images"]=get_prdouct_images(product_guid, "image-thumbnail");
		
		//***************************************************************************************************	
		//Get Product Images
		//***************************************************************************************************	
		strSQL
			= "select file_path, attachment_type_code "
			+ "  from pim_product_images_v"
			+ " where product_guid=?"
			+ "   and lang_code=?"
			+ "   and bu_code=?"
			+ " order by image_seq";
		var images = context.execSQL(strSQL, [product_guid, lang, bu_code]);
	
		if (images && images.length > 0) {
			for (var i=0; i<images.length; i++) {
				var image = images[i];
				var attach_type = getLangValue(image['attachment_type_code'], lang);
				
				if(attach_type == "image-thumbnail"){
					rtn["images"].push({"file": image.file_path});
				}
			}
		}
		strSQL
		= "	select guid, product_number "
		+ "	from pim_product_master a "
		+ " where exists (select 1 from pim_product_attribute_values_v b where a.guid=b.product_guid and b.attribute_code='web_active' and b.attribute_values1=1) "
		+ " and ifnull(deleted, 0)=0"
		+ " and guid=?"
		+ " and bu_code=?";
		
		var products = context.execSQL(strSQL, [product_guid,bu_code]);
	
		if (products && products.length > 0) {
			rtn["id"]=products[0]['product_number'];		//Product Id
		}
		return rtn;
	}

	response.end(productDetail_result);
} 















/*

order history

*/

function handleRequest3(session, request, response, params){
	var lang = "fr";//session.lang.code;
	var bu_code = "vtefr";
	var bu_languages = [];
	var target = "cart"
	var context;
	var strSQL = "";

	var result = {
        user: session.webUser,
        orders: []
    };
    
    // Get order histories
    if (!session.webUser || !session.webUser.guid) {
    	response.statusCode = 401;
    	return response.end({
    		success: false,
    		error: '$Unauthorized'
    	});
    }
    
    context.order.query.where.userID.equal(session.webUser.guid);
    
    // Filter by status    
    if (params.status) {
        context.order.query.and.paymentStatus.equal(params.status);
    }
    // Paging
    if (params.limit) {
        context.order.fetchRangeRecords(0, parseInt(params.limit));
    } else {
    	context.order.fetchRecords();
    }
    
    context.order.orderBy.orderDate.desc;
	
	var order = context.order.first;
    if (!order) {
    	return response.end({
    		success: false,
    		result: result,
    		error: 'Order not found'
    	});
    }    
    
    while(order) {
    	var rs = {
            guid:			order.guid,
            userID: 		order.userID,
            orderID:		order.orderID,
            orderNumber:	order.orderNumber,
            orderDate:		order.orderDate,
            total:			order.total,
            currency:		order.currency,
            createDate: 	order.createDate,
            paymentStatus:	order.paymentStatus,
            paymentRef: 	order.paymentRef,
            paymentMethod:	order.paymentMethod,
            status: 		order.status,
            TVA:			order.TVA,
            subTotal:		order.subTotal,
            address1:		order.shippingAddress1,
            shippingCost:	order.shippingCost || 0,
            shippingMethod: order.shippingMethod,
            shippingCity:	order.shippingCity,
            shippingEmail:	order.shippingEmail,
            shippingFirstName:		order.shippingFirstName,
            shippingLastName:		order.shippingLastName,
            shippingPhoneNumber:	order.shippingPhoneNumber,
            shippingPostalCode: 	order.shippingPostalCode,
            shippingState:			order.shippingState,
            discount:				order.discount || 0,
            details: []
        }
        
        var rdOrderDetail = order.orderDetail.first;
        
        while (rdOrderDetail) {
        	var rdProduct = getProductDetail(rdOrderDetail.productGUID);
        	
        	if (rdProduct) {
        		var rdImage;
                
                if (rdProduct.images && rdProduct.images.length) {
                	rdImage = rdProduct.images[0].file;
                } else if (rdProduct.promo_banner) {
	                rdImage = rdProduct.promo_banner;
                }
                
                let rsDetail = {
                    orderGuid: rdOrderDetail.orderGUID,
                    productGuid: rdOrderDetail.productGUID,
                    sku: rdOrderDetail.sku,
                    unitPrice: rdOrderDetail.unitPrice,
                    quantity: rdOrderDetail.quantity,
                    points: rdOrderDetail.points,
                    totals: rdOrderDetail.unitPrice * rdOrderDetail.quantity,
                    product: {
                        // guid: rdProduct.guid,
                        productName: rdProduct.name,
                        image: rdImage,
                        productCode: rdProduct.code,
                    }
                    // diyItems: diyItems,
                    // accessories: accessories
                }
                rs.details.push(rsDetail);
        	}
        	
        	rdOrderDetail = order.orderDetail.next;
        }
        result.orders.push(rs);
    	order = context.order.next;
    }
    
    response.end({
        success: true,
        result: result
    });
    
    //***************************************************************************************************	
	//Get Cart Detail 
	//***************************************************************************************************	
	function getProductDetail(product_guid) {
		var rtn = {};
		var attribute_list = '("display_name","price_retail","price_special")';
		
		rtn["code"]				 = "";		//Product Code
		rtn["name"]				 = "";		//Product Name 
		rtn["description"]		 = "";		//Product Description (default)
		rtn["desc_extra"]		 = "";		//Product Descripiont Extra
		rtn["age_range"]		 = "";		//Product Age range
		rtn["learn_more"]		 = "";		//Product Learn More 
		rtn["battery"]			 = [];		//Product Battery
		rtn["warning"]			 = [];		//Prodcut Warning
		rtn["videos"]			 = "";		//Product Videos
		rtn["videos_img"]		 = "";		//Product Videos Image
		rtn["price"]			 = "";		//Product Price (Retail)
		rtn["special_price"]	 = "";		//Prdouct Price (Special)
		rtn["stock"]			 = 1;		//Product Stock - 0:no stock; 1:stock availiable; Default:0; [TODO]
		rtn["promo_title"]		 = "";		//Product Poromotion Title
		rtn["promo_banner"]		 = "";		//Product Banner
		rtn["promo_banner_url"]	 = [];		//Product Banner link
		rtn["model_title"]		 = [];		//Product Model Title
		rtn["model_url"]		 = [];		//Product Model Url		
		rtn["edu_con_icon"]		 = [];		//Product Education Contributions Icon
		rtn["edu_con_desc"]		 = [];		//Product Education Contributions Description
		rtn["award_badges_icon"] = "";		//Product Award Icon
		rtn["award_badges_url"]	 = "";		//Product Award Url
		rtn["images"]			 = [];		//Product Image
		rtn["id"]				 = "";		//Product Id
		rtn["guid"]			 	 = product_guid;		//Product guid
		rtn["max_quantity"]		 = 10;		//Product Max Quantity
		
		strSQL	
			= "select product_number code, attribute_code, attribute_datatype, attribute_values1, attribute_values2, attribute_guid, attribute_value_guid "
			+ "  from pim_product_attribute_values_v "
			+ "  where product_guid=? "
			+ "   and pm_bu_code=? "
			+ "   and attribute_code in " + attribute_list
			+ " order by attribute_code, row_seq ";
		
		var details = context.execSQL(strSQL, [product_guid,bu_code]);

		
		if (details && details.length > 0) {
			for (var i=0; i<details.length; i++) {
				var detail	= details[i];
				var value	= getLangValue(detail["attribute_values1"],lang);
				var value2	= getLangValue(detail["attribute_values2"],lang);
				
				switch(detail["attribute_code"]) { 

					//Display name
					case "display_name": { 
						rtn["name"]=value;
						break; 
					} 


					//Retail Price
					case "price_retail": { 
						rtn["price"]=round(value);
						break; 
					} 		
					
					//Special Price
					case "price_special": { 
						rtn["special_price"]=round(value);
						break; 
					} 	
					
					//Banner Image
					case "banner_img":{
						rtn["promo_banner"]=value;
						break;
					}
				} 
				
			}
		}
		
		//***************************************************************************************************	
		//Get Product Images
		//***************************************************************************************************	
		strSQL
			= "select file_path, attachment_type_code "
			+ "  from pim_product_images_v"
			+ " where product_guid=?"
			+ "   and lang_code=?"
			+ "   and bu_code=?"
			+ " order by image_seq";
		var images = context.execSQL(strSQL, [product_guid, lang, bu_code]);
	
		if (images && images.length > 0) {
			for (var i=0; i<images.length; i++) {
				var image = images[i];
				var attach_type = getLangValue(image['attachment_type_code'], lang);
				
				if(attach_type == "image-thumbnail"){
					rtn["images"].push({"file": image.file_path});
				}
			}
		}
		strSQL
		= "	select guid, product_number "
		+ "	from pim_product_master a "
		+ " where exists (select 1 from pim_product_attribute_values_v b where a.guid=b.product_guid and b.attribute_code='web_active' and b.attribute_values1=1) "
		+ " and ifnull(deleted, 0)=0"
		+ " and guid=?"
		+ " and bu_code=?";
		
		var products = context.execSQL(strSQL, [product_guid,bu_code]);
	
		if (products && products.length > 0) {
			let product = products[0];
			rtn["id"] = product['product_number'];		//Product Id
			rtn["code"] = product['product_number']
			debugger
		}
		return rtn;
	}
}












/*

check promo

*/
var TAX = 0.2;
const promotionTypes = {
	cart_discount: 'Whole cart discount',
	tax_discount: 'Tax (TVA) discount',
	shipping_discount: 'Shipping Discount'
}
	
function handleRequest4(session, request, response, params){
	var context;
	var result = {};
	
	if (request.method == 'GET') {
		if (params.code) {
			context.productPromotion.reset();
			context.productPromotion.query.where.code.equal(params.code);
			context.productPromotion.orderBy.modifyDate.desc;
			context.productPromotion.fetchRecords();
			
			var rd = context.productPromotion.first;
			
			if (!rd) {
				result = {
		            success: false,
		            error: 'Promo code is invalid'
		        };
			} else if (rd.disabled) {
				result = {
		            success: false,
		            error: 'Promo code is unavailable'
		        };
			} else if ((rd.activation || 0) >= (rd.maxActivation == undefined ? 1000000: rd.maxActivation)) {
				result = {
		            success: false,
		            error: 'Promo code is reached to maximum usage'
		        };
			} else if (rd.startDate > new Date()) {
				result = {
		            success: false,
		            error: 'Promo code cannot be used for now. Please try again later'
		        };
			} else if (rd.endDate < new Date()) {
				result = {
		            success: false,
		            error: 'Promo code is expired'
		        };
			} else {
				result = {
		            success: true,
		            promotion: {
		            	guid: rd.guid,
		            	code: rd.code,
		            	name: rd.name,
		            	disabled : rd.disabled,
		            	startDate: rd.startDate,
		            	endDate: rd.endDate,
		            	description: rd.description,
		            	value: rd.value,
		            	discountType: rd.discountType,
		            	minAmount: rd.minAmount,
		            	allProduct: rd.allProduct,
		            	maxActivation: rd.maxActivation,
		            	activation: rd.activation,
		            	promotionType: rd.promotionType,
		            	free: rd.free,
		            	promotionTypeName: promotionTypes[rd.promotionType]
		            }
		            
		            // total: 0,
		            // subTotal: 0,
		            // discount: 0,
		            // products: []
		        };
		        
		        /*
		        
		        // Get cart
		        try {
		        	var cart = JSON.parse(request.cookies['cart_items'] || null);
		        } catch (e) {
		            var cart = null;
		        }
		        if (!cart) {
		        	return response.end({
		                success: false,
		                error: '$empty_cart'
		            });
		        }
		        
		        for (let v in cart) {
			    	let item = cart[v];
		    		var itemPrice = item.qty * item.price;
			    	
			    	result.total += itemPrice;
			    }
			    
			    result.subTotal = result.total;
			    
			    // whole cart’s amount discount
			    if (rd.allProduct) {
			    	if (result.total > (rd.minAmount || 0)) {
			    		var values = calculateItemAmount(result.total, rd);
			    		
			    		result.discount = values.discount;
			    		result.total = values.total;
			    	} else {
			    		result = {
				            success: false,
				            error: 'Promo code is valid for minimum order amount: ' + (params.currency ? (params.currency + ' '): '')  + rd.minAmount
				        };
			    	}
			    
				} else {
					result = {
			            success: false,
			            error: 'Promo code is unavailable'
			        };
				}
				*/
			}
		} else {
			result = {
	            success: false,
	            error: 'Please enter promo code'
	        }
	        
		}
	    
		response.end(result);
	} else if (request.method == 'POST') {
		var rd = context.productPromotion.append();
		rd.name = params.name;
		rd.code =params.code;
		rd.disabled =  params.disabled;
		rd.startDate = params.startDate;
		rd.endDate = params.endDate;
		rd.description = params.description;
		rd.value = params.value;
		rd.discountType = params.discountType;
		rd.minAmount = params.minAmount;
		rd.allProduct = params.allProduct;
		rd.promotionType = params.promotionType;
		rd.free = params.free;
		params.guid = rd.guid;
		context.save();
		response.end({'success': true, result: params});
	}
}

function calculateItemAmount(total, promo) {
	var discountType = promo.discountType;
	var amount = total;
	
	// apply promotion to TAX;
	if (promo.promotionType == 'tax_discount') {
		amount = amount * TAX;
	}

	var result = {
		discount: 0,
		total: total
	};

	if (promo.promotionType == 'tax_discount' && promo.free) {
		return { 
			discount: amount,
			total: total
		};
	} else {
		if (discountType == '%') {
			result.discount = (amount * promo.value) / 100;
		} else {
			result.discount = promo.value;
		}
	}
	
	if (result.discount > amount) {
		result.discount = amount;
	}
	
	if (promo.promotionType == 'tax_discount') {
		result.total = result.total + result.discount;
	} else {
		result.total = result.total - result.discount;
		result.total = result.total + (result.total * TAX);
	}
	
	return result;
}







/*

checkout

*/
const IOrderItem ={
   key
}
const IShippingInfo= {
    firstName,
    lastName,
    email,
    phone,
    streetAddressLine1,
    city,
    state,
    postalCode,
    country
}
const IBillingInfo= {
    firstName,
    lastName,
    email,
    phone,
    streetAddressLine1,
    city,
    state,
    postalCode,
    country
}

const ICheckoutInfo= {
    shippingInfo: IShippingInfo,
    billingInfo: IBillingInfo,
    shippingMethod,
    paymentMethod,
    promotionCode
}

function handleRequest5(session, request, response, params) {
    if (request.method == 'GET') {
        var context;
		if (session.lang)
			context.options.locale = session.lang.code;

		// Get cart
        try {
        	var cart = JSON.parse(request.cookies['cart_items'] || null);
        } catch (e) {
            var cart = null;
        }
        if (!cart) {
        	return response.end({
                success: false,
                error: '$empty_cart'
            });
        }

		context.paymentMethod.query.where.enabled.equal(true);
        context.paymentMethod.fetchRecords();
        context.shippingMethod.fetchRecords();
        context.productOption.fetchRecords();
        context.productOptionValue.fetchRecords();
        
        var result = {
            product: [],
            paymentMethod: [],
            shippingMethod: [],
            TVA: 0.2,
            total: 0,
            subTotal: 0,
        }
        var rdPayment = context.paymentMethod.first;
        while (rdPayment) {
            result.paymentMethod.push({
                guid: rdPayment.guid,
                code: rdPayment.code,
                name: rdPayment.name
            })
            rdPayment = context.paymentMethod.next
        }
        var rdShipping = context.shippingMethod.first;
        while (rdShipping) {
            result.shippingMethod.push({
                guid: rdShipping.guid,
                code: rdShipping.code,
                name: rdShipping.name,
                cost: rdShipping.cost
            })
            rdShipping = context.shippingMethod.next
        }
        
        for (let v in cart) {
	    	let product;
	    	let item = cart[v];
    		product = getNormalProduct(item, v, context);
	    	
	    	if (product) {
	    		result.total = result.total + product.total;
	        	result.product.push(product);;
	    	}
	    }
	    result.subTotal = result.total;
	    
	    // result.total += result.total * TVA;
	    // result.subTotal += result.subTotal * TVA;
	    result.TVA = 0.2;
        return response.end(result);
    }
    else if (request.method == 'POST') {
		var context;
		var data = ICheckoutInfo;

		if (session.lang)
			context.options.locale = session.lang.code;
		
		// Get cart
        try {
        	var cart = JSON.parse(request.cookies['cart_items'] || null);
        } catch (e) {
            var cart = null;
        }
        if (!cart) {
        	return response.end({
                success: false,
                error: '$empty_cart'
            });
        }

        context.shippingMethod.query.where.code.equal(data.shippingMethod);
        context.paymentMethod.query.where.code.equal(data.paymentMethod).and.enabled.equal(true);
        context.shippingMethod.fetchRecords();
        context.paymentMethod.fetchRecords();
        // context.productOption.fetchRecords();
    	// context.productOptionValue.fetchRecords();
    	// context.site.fetchRecords();
    	
    	// promotion
    	// context.productPromotion.query.where.code.equal(data.promotionCode);
    	// context.productPromotion.fetchRecords();
    	
    	//
        // if (context.shippingMethod.count != 1)
        //     return response.end({
        //         success: false,
        //         error: '$shipping_method_not_selected'
        //     })
        if (context.paymentMethod.count != 1) {
            return response.end({
                success: false,
                error: '$payment_method_not_selected'
            });
        }
		// var site = context.site.first;
		// if (site)
		// 	var currency = site.currency || "HKD";
        var order = context.order.append();
        try {
        	let user = session.webUser;
        	order.userID = (user) ? user.guid : null;
	        order.billingAddress1 = data.billingInfo.streetAddressLine1
	        order.billingCity = data.billingInfo.city;
	        order.billingEmail = data.billingInfo.email;
	        order.billingFirstName = data.billingInfo.firstName;
	        order.billingLastName = data.billingInfo.lastName;
	        order.billingPhoneNumber = data.billingInfo.phone;
	        order.billingPostalCode = data.billingInfo.postalCode;
	        order.billingState = data.billingInfo.state;
	        order.shippingAddress1 = data.shippingInfo.streetAddressLine1;
	        order.shippingCity = data.shippingInfo.city;
	        order.shippingEmail = data.shippingInfo.email;
	        order.shippingFirstName = data.shippingInfo.firstName;
	        order.shippingLastName = data.shippingInfo.lastName;
	        order.shippingPhoneNumber = data.shippingInfo.phone;
	        order.shippingPostalCode = data.shippingInfo.postalCode;
	        order.shippintState = data.shippingInfo.state;
	        // order.orderID = 
        } catch (e) {
        	console.log(e);
        	return response.end({
                success: false,
                error: '$missing_data'
            });
        }

        order.paymentMethod = data.paymentMethod
        order.paymentStatus = 'draft';
        order.currency = 'HKD';
        order.orderDate = new Date();

        var rdShipping = context.shippingMethod.first;
        var orderResult = {
            success: true,
            guid: order.guid,
            paymentMethod: data.paymentMethod,
            currency: order.currency,
            items: [],
            subtotal: 0,
            total: 0,
            discount: 0,
            shipping: rdShipping?rdShipping.cost: 0,
            TVA: 0.2
        }
        
        for (let v in cart) {
	    	let product;
	    	let item = cart[v];
    		product = getNormalProduct(item, v, context);
	    	
	    	if (product) {
	    		orderResult.total = orderResult.total + product.total;
		        orderResult.items.push(product);
		        
		        // Append details
	            let orderDetail = order.orderDetail.append();
	            orderDetail.productGUID = product.guid;
	            orderDetail.sku = product.sku;
	            orderDetail.quantity = product.qty;
	            orderDetail.unitPrice = product.price;
	            orderDetail.points = product.price * 10;
	    	}
	    }
		
        orderResult.subtotal = orderResult.total;
        orderResult.subtotal = Math.round(orderResult.subtotal * 100) / 100;
        orderResult.total = Math.round((orderResult.subtotal + orderResult.shipping) * 100) / 100;
        
        // promotion
		// var rdPromo = context.productPromotion.first;
		// if (rdPromo && data.promotionCode) {
		// 	if(!rdPromo.disabled && rdPromo.startDate < new Date() && rdPromo.endDate > new Date()) {
		// 		let discountType = rdPromo.discountType;
		    
		// 		// whole cart’s amount discount
		// 	    if (rdPromo.allProduct) {
		// 	    	if (orderResult.subtotal > (rdPromo.minAmount || 0)) {
		// 	    		if (discountType == '%') {
		// 	    			orderResult.discount = (orderResult.subtotal * rdPromo.value) / 100;
		// 	    		} else {
		// 	    			orderResult.discount = rdPromo.value;
		// 	    		}
			    		
		// 	    		if (orderResult.discount > orderResult.total) {
		// 	    			orderResult.discount = orderResult.total;
		// 	    		}
			    		
		// 	    		orderResult.total = Math.round(( orderResult.total - orderResult.discount ) * 100) / 100;
		// 	    	}
		// 		}
		// 	}
		// }
        
		// TVA
  //      orderResult.total += orderResult.total * orderResult.TVA;
		// orderResult.subtotal += orderResult.subtotal * orderResult.TVA;
		
        order.total = orderResult.total;
        order.subTotal = orderResult.subtotal;
        order.TVA = orderResult.TVA;
        // order.discount = orderResult.discount;
        // rdPromo && (order.promotionGUID = rdPromo.GUID);

        context.save();
        return response.end(orderResult);
    }
	else {
        response.end({success: false});
    }
}

function getSKUOption(value) {
	var context;
	var result = [];
	if (value){
		var options = value.split('/');
		for (var i = 0; i < options.length; i ++){
			context.productOptionValue.reset();
			context.productOptionValue.query.where.guid.equal(options[i]);
			context.productOptionValue.fetchRecords();
			var rdValue = context.productOptionValue.first;
			if (rdValue) {
				context.productOption.reset();
				context.productOption.query.where.guid.equal(rdValue.optionGUID);
				context.productOption.fetchRecords();
				var rdOption = context.productOption.first;
				if (rdOption) {
					result.push({
						name: rdOption.name,
						value: rdValue.name,
						optionGUID: rdOption.guid
					});
				}
			}
		}
	}
	return result;
}

function getNormalProduct(item, itemId, context) {
	let skuId;
	let productGUID;
	if (itemId.indexOf('$') > -1) {
		let _id = itemId.split('$');
		productGUID = _id[0];
		skuId = _id[1];
		// result.sku.push(skuId);
	} else {
		productGUID = itemId;
	}
	context.productMaster.reset();
	context.productMaster.query.where.guid.equal(productGUID);
	context.productMaster.fetchRecords();
    var rdProduct = context.productMaster.first;
    if (!rdProduct) {
    	return null;
    }

	// Get Images	    
    rdProduct.productImage.sort(function(r1, r2) {
        if (r1.ordering > r2.ordering)
            return 1
        else if (r1.ordering < r2.ordering)
            return -1
        else
            return 0;
    });
    var rdImage = rdProduct.productImage.first;
    while (rdImage && rdImage.archived) {
    	rdImage = rdProduct.productImage.next;
    }

	var product;
	if (skuId) {
		context.productSKU.reset();
        context.productSKU.query.where.guid.equal(skuId).and.productGUID.equal(productGUID).and.active.equal(true).and.priceAdj.greaterThan(0);
        context.productSKU.fetchRecords();
        var rdSKU = context.productSKU.first;
        if (rdSKU){
    		var price = rdProduct.price + (rdSKU.priceAdj || 0);
    		var specialPrice = rdProduct.specialPrice? rdProduct.specialPrice + (rdSKU.priceAdj || 0): 0;

			product = {
	            id: rdProduct.id,
	            skuGUID: rdSKU.guid,
	            sku: rdSKU.sku,
	            priceAdj: rdSKU.priceAdj,
	            guid: rdProduct.guid,
	            code: rdProduct.code,
	            category: rdProduct.productCategory.code,
	            name: rdProduct.name,
	            desc: rdProduct.shortDesc,
	            options: getSKUOption(rdSKU.options),
	            image: rdImage ? rdImage.file.url : '',
	            price: specialPrice * 1.2 || price * 1.2,
	            // specialPrice: specialPrice,
	            qty: item.qty,
	            total: item.qty * 1.2 * (specialPrice?specialPrice:price)
	        }
        }
        return product;
	}

    product = {
        id: rdProduct.id,
        skuGUID: '',
        sku: '',
        guid: rdProduct.guid,
        code: rdProduct.code,
        category: rdProduct.productCategory.code,
        name: rdProduct.name,
        desc: rdProduct.shortDesc,
        options: [],
        image: rdImage ? rdImage.file.url : '',
        price: rdProduct.specialPrice * 1.2 || rdProduct.price * 1.2,
        // specialPrice: rdProduct.specialPrice,
        qty: item.qty,
        total: item.qty * 1.2 * (rdProduct.specialPrice ? rdProduct.specialPrice : rdProduct.price)
    }
    return product;
}








/*

checkout pim

*/
const IOrderItem = {
   key: string
}

const IShippingInfo= {
    firstName,
    lastName,
    email,
    phone,
    streetAddressLine1,
    city,
    state,
    postalCode,
    country
}
const IBillingInfo= {
    firstName,
    lastName,
    email,
    phone,
    streetAddressLine1,
    city,
    state,
    postalCode,
    country
}

const ICheckoutInfo ={
    shippingInfo: IShippingInfo,
    billingInfo: IBillingInfo,
    shippingMethod,
    paymentMethod,
    promotionCode
}

const IOrder= {
	user,
	orderID,
    success: boolean,
    guid,
    paymentMethod,
    paymentMethodName,
    currency,
    items: [],
    subtotal: number,
    total: number,
    discount: number,
    shipping: number,
    shippingMethod,
    orderDate,
    confirmEmail,
    shippingEmail,
    billingEmail,
    TVA: number
    // currencySymbol
}

var lang = "fr";//session.lang.code;
var bu_code = "vtefr";
var bu_languages = [];
var target = "cart"
var promotionTypes = {
	cart_discount: 'cart_discount',
	tax_discount: 'tax_discount',
	shipping_discount: 'shipping_discount'
}	

function handleRequest6(session, request, response, params){
	var context;
	var strSQL = "";
	var TVA = 0.2;
	
	debugger
	
	if (session.lang) {
		context.options.locale = session.lang.code;
	}
			
	if (request.method == 'GET') {
		var result = [];
		var product_guid=[];
		
		//***************************************************************************************************	
		//Get Product Detail
		//***************************************************************************************************	
		try {
	        var cart = JSON.parse(request.cookies['cart_items'] || null);
	    } catch (e) {
	        var cart = null;
	    }
	    if (!cart) {
	    	return response.end({
	            success: false,
	            error: '$empty_cart'
	        });
	    }
	    for (let v in cart) {
	    	let product;
	    	let item = cart[v];
			product = get_cart_detail(v, item);
	    	if (!product) {
	    		continue;
	    	}
	    	
	    	product_guid.push(v);
	        result.push(product);
	    }
	   
		var productDetail_result = {
			"success": 'false',
			"max_quantity_cart": 30,
			"type": "",
			"paymentMethod": [],
	        "shippingMethod": [],
	        "TVA": TVA,
			"data": {}				
		};
		
	    context.paymentMethod.query.where.enabled.equal(true);
	    context.paymentMethod.fetchRecords();
	    context.shippingMethod.fetchRecords();
	    context.productOption.fetchRecords();
	    context.productOptionValue.fetchRecords();
	    
	    var rdPayment = context.paymentMethod.first;
	    while (rdPayment) {
	        productDetail_result.paymentMethod.push({
	            guid: rdPayment.guid,
	            code: rdPayment.code,
	            name: rdPayment.name
	        })
	        rdPayment = context.paymentMethod.next
	    }
	    var rdShipping = context.shippingMethod.first;
	    while (rdShipping) {
	        productDetail_result.shippingMethod.push({
	            guid: rdShipping.guid,
	            code: rdShipping.code,
	            name: rdShipping.name,
	            cost: rdShipping.cost
	        })
	        rdShipping = context.shippingMethod.next
	    }
	    
		//Check Product Active
		// var active = check_product_active(product_guid, context);
		//***************************************************************************************************		
		// Check product active
		//***************************************************************************************************	
		var active = {
					"success" : false,
					"product_number" : ""
		};
		strSQL
			= "	select guid, product_number "
			+ "	from pim_product_master a "
			+ " where exists (select 1 from pim_product_attribute_values_v b where a.guid=b.product_guid and b.attribute_code='web_active' and b.attribute_values1=1) "
			+ " and ifnull(deleted, 0)=0"
			+ " and guid in (\"" + product_guid.join('\",\"') +"\")"
			+ " and bu_code=?";
		
		var products = context.execSQL(strSQL, [bu_code]);
		
		if (products && products.length > 0) {
			active["success"] = true;	
			// active["product_number"] = products[0]['product_number'];
		}
			
		if(active.success){
			// get available languages
			strSQL = "select language_code,language_name from pim_bu_language where bu_code=?";
			var languages = context.execSQL(strSQL, [bu_code]);
			if (languages && languages.length > 0) {
				var bu_without_english = true;
		
				for (var i=0; i<languages.length; i++) {
					var language = languages[i];
		
					bu_languages.push({
						"code": language.language_code,
						"name": language.language_name
					});
		
					if ((bu_without_english) && (language.language_code == "en")) {
						bu_without_english = false;
					}
				}
		
				if (bu_without_english) {
					bu_languages.push({
						"code": "en",
						"name": "English"
					});
				}
			}
		
			//Select Target
			switch(target) { 
				//Cart page
				case "cart": { 
					productDetail_result["success"] = 'true';
					productDetail_result["type"] = target;
					productDetail_result["max_quantity_cart"] = 30;
					productDetail_result["data"] = result;
					// productDetail_result["data"]["id"] = active.product_number;
					// productDetail_result["data"]["guid"] = product_guid;
					break; 
				} 
				
				//[todo] Prdouct detial page
				case "product_detial": { 
					productDetail_result["success"] = 'true';
					productDetail_result["type"] = target;
					productDetail_result["max_quantity_cart"] = 30;
					productDetail_result["data"] = [] 
					break; 
				} 
				
			}
			
		}
		
	
		//***************************************************************************************************	
		//[todo] Get Product Attachment
		//***************************************************************************************************	
		function get_product_attachment(){}
		
		
		//***************************************************************************************************	
		//[todo] Get Product Stock
		//***************************************************************************************************	
		function get_product_stock(){}
		
		//***************************************************************************************************	
		//Get Cart Detail 
		//***************************************************************************************************	
		function get_cart_detail(product_guid, cartItem){
			
			var rtn = {};
			var attribute_list = '("display_name","price_retail","price_special")';
			
			// rtn=get_product_attribute_vale(product_guid, attribute_list);
			
			rtn["name"]				 = "";		//Product Name 
			rtn["description"]		 = "";		//Product Description (default)
			rtn["desc_extra"]		 = "";		//Product Descripiont Extra
			rtn["age_range"]		 = "";		//Product Age range
			rtn["learn_more"]		 = "";		//Product Learn More 
			rtn["battery"]			 = [];		//Product Battery
			rtn["warning"]			 = [];		//Prodcut Warning
			rtn["videos"]			 = "";		//Product Videos
			rtn["videos_img"]		 = "";		//Product Videos Image
			rtn["price"]			 = "";		//Product Price (Retail)
			rtn["special_price"]	 = "";		//Prdouct Price (Special)
			rtn["stock"]			 = 1;		//Product Stock - 0:no stock; 1:stock availiable; Default:0; [TODO]
			rtn["promo_title"]		 = "";		//Product Poromotion Title
			rtn["promo_banner"]		 = "";		//Product Banner
			rtn["promo_banner_url"]	 = [];		//Product Banner link
			rtn["model_title"]		 = [];		//Product Model Title
			rtn["model_url"]		 = [];		//Product Model Url		
			rtn["edu_con_icon"]		 = [];		//Product Education Contributions Icon
			rtn["edu_con_desc"]		 = [];		//Product Education Contributions Description
			rtn["award_badges_icon"] = "";		//Product Award Icon
			rtn["award_badges_url"]	 = "";		//Product Award Url
			rtn["images"]			 = [];		//Product Image
			rtn["id"]				 = "";		//Product Id
			rtn["guid"]			 	 = product_guid;		//Product guid
			rtn["quantity"]			 = cartItem.qty;		//Product Max Quantity
			rtn["max_quantity"]		 = 10;		//Product Max Quantity
			strSQL	
				= "select attribute_code, attribute_datatype, attribute_values1, attribute_values2, attribute_guid, attribute_value_guid "
				+ "  from pim_product_attribute_values_v "
				+ "  where product_guid=? "
				+ "   and pm_bu_code=? "
				+ "   and attribute_code in " + attribute_list
				+ " order by attribute_code, row_seq ";
			
			var details = context.execSQL(strSQL, [product_guid,bu_code]);
			
			
			if (details && details.length > 0) {
				for (var i=0; i<details.length; i++) {
					var detail = details[i];
					var value = getLangValue(detail["attribute_values1"],lang);
					var value2 = getLangValue(detail["attribute_values2"],lang);
					
					switch(detail["attribute_code"]) { 
	
						//Display name
						case "display_name": { 
							rtn["name"]=value;
							break; 
						} 
	
						//Description
						case "desc": { 
							rtn["description"]=value;
							break; 
						} 
						
						//Description Extra
						case "desc_extra": { 
							rtn["desc_extra"]=value;
							break; 
						} 
						
						//Age Range
						case "age_range": { 
							rtn["age_range"]={"from":parseInt(value),"to":parseInt(value2)};
							break; 
						} 
	
						//Learn More 
						case "learn_more_desc": { 
							rtn["learn_more"]=value;
							break; 
						} 	
						
						//Battery
						case "battery": { 
							rtn["battery"].push({value});
							break; 
						} 						
						
						//Warring
						case "warning": { 
							rtn["warning"].push({value});
							break; 
						} 	
						
						//Video
						case "video_link": { 
							rtn["videos"]=value;
							break; 
						} 	
						
						//Video Img
						case "video_img": { 
							rtn["videos_img"]=value;
							break; 
						} 
	
						//Retail Price
						case "price_retail": { 
							rtn["price"]=round(value);
							break; 
						} 		
						
						//Special Price
						case "price_special": { 
							rtn["special_price"]=round(value);
							break; 
						} 	
						
						//Educational Contributions Icon
						case "edu_con_icon":{
							rtn["edu_con_icon"].push({"file":value});
							break;
						}
						
						//Educational Contributions Description
						case "edu_con_desc":{
							rtn["edu_con_desc"].push({value});
							break;
						}
						
						//Award Icon
						case "award_badges_img":{
							rtn["award_badges_icon"]=value;
							break;
						}
						
						//Award Url
						case "award_badges_url":{
							rtn["award_badges_url"]=value;
							break;
						}			
						
						//Banner Image
						case "banner_img":{
							rtn["promo_banner"]=value;
							break;
						}
						
						//Banner Url
						case "banner_url":{
							rtn["promo_banner_url"].push({value});
							break;
						}
						
						//Model Title
						case "model_title":{
							rtn["model_title"].push({value});
							break;
						}
						
						//Model Url
						case "model_link":{
							rtn["model_url"].push({value});
							break;
						}
						
						//Promo Title
						case "promo_title":{
							rtn["promo_title"]=value;
							break;
						}
						
						
					} 
					
				}
			}
			
			// rtn["images"]=get_prdouct_images(product_guid, "image-thumbnail");
			
			//***************************************************************************************************	
			//Get Product Images
			//***************************************************************************************************	
			strSQL
				= "select file_path, attachment_type_code "
				+ "  from pim_product_images_v"
				+ " where product_guid=?"
				+ "   and lang_code=?"
				+ "   and bu_code=?"
				+ " order by image_seq";
			var images = context.execSQL(strSQL, [product_guid, lang, bu_code]);
		
			if (images && images.length > 0) {
				for (var i=0; i<images.length; i++) {
					var image = images[i];
					var attach_type = getLangValue(image['attachment_type_code'], lang);
					
					if(attach_type == "image-thumbnail"){
						rtn["images"].push({"file": image.file_path});
					}
				}
			}
			strSQL
			= "	select guid, product_number "
			+ "	from pim_product_master a "
			+ " where exists (select 1 from pim_product_attribute_values_v b where a.guid=b.product_guid and b.attribute_code='web_active' and b.attribute_values1=1) "
			+ " and ifnull(deleted, 0)=0"
			+ " and guid=?"
			+ " and bu_code=?";
			
			var products = context.execSQL(strSQL, [product_guid,bu_code]);
		
			if (products && products.length > 0) {
				rtn["id"]=products[0]['product_number'];		//Product Id
			}
			return rtn;
		}
	
		response.end(productDetail_result);
    } else if (request.method == 'POST') {
    	var data = ICheckoutInfo;

    	// Get cart
        try {
        	var cart = JSON.parse(request.cookies['cart_items'] || null);
        	var promotion = JSON.parse(request.cookies['cart_promotion'] || null);
        	
        	if (promotion){
				data.promotionCode = promotion.promoCode;
			}
        } catch (e) {
            var cart = null;
        }
        if (!cart) {
        	return response.end({
                success: false,
                error: '$empty_cart'
            });
        }
    	
    	context.shippingMethod.query.where.code.equal(data.shippingMethod);
        context.paymentMethod.query.where.code.equal(data.paymentMethod).and.enabled.equal(true);
        context.shippingMethod.fetchRecords();
        context.paymentMethod.fetchRecords();
        
        // promotion
    	context.productPromotion.query.where.code.equal(data.promotionCode);
    	context.productPromotion.fetchRecords();
        
        if (context.paymentMethod.count != 1) {
            return response.end({
                success: false,
                error: '$payment_method_not_selected'
            });
        }
        
        var site = context.site.first,
        	currency = 'EUR';
        	
		if (site) {
			currency = site.currency || currency;
		}
		
        var order = context.order.append();
        let user;
        try {
        	user = session.webUser;
        	order.userID = (user) ? user.guid : null;
	        order.billingAddress1 = data.billingInfo.streetAddressLine1;
	        order.billingCity = data.billingInfo.city;
	        order.billingEmail = data.billingInfo.email;
	        order.billingFirstName = data.billingInfo.firstName;
	        order.billingLastName = data.billingInfo.lastName;
	        order.billingPhoneNumber = data.billingInfo.phone;
	        order.billingPostalCode = data.billingInfo.postalCode;
	        order.billingState = data.billingInfo.state;
	        order.shippingAddress1 = data.shippingInfo.streetAddressLine1;
	        order.shippingCity = data.shippingInfo.city;
	        order.shippingEmail = data.shippingInfo.email;
	        order.shippingFirstName = data.shippingInfo.firstName;
	        order.shippingLastName = data.shippingInfo.lastName;
	        order.shippingPhoneNumber = data.shippingInfo.phone;
	        order.shippingPostalCode = data.shippingInfo.postalCode;
	        order.shippingState = data.shippingInfo.state;
	        order.shippingStatus = 'non_shipping';
        } catch (e) {
        	console.log(e);
        	return response.end({
                success: false,
                error: '$missing_data'
            });
        }
 
        try {
        	order.orderID = session.getSequence('ecom_order_id').toString();
	        order.orderNumber = OrderNumber_Generator();
        } catch(e) {
        	console.log(e);
        	return response.end({
                success: false,
                error: '$can_not_create_order_id',
                test: e.message
            });
        }
        
        order.paymentStatus = 'draft';
        order.currency = currency;
        order.orderDate = new Date();
        
        // append Payment Method
		var rdPaymentMethod = context.paymentMethod.first;
        order.paymentMethod = rdPaymentMethod.code;
        
        // append Shipping Method
		var rdShippingMethod = context.shippingMethod.first,
			_shippingMethod  = rdShippingMethod ? rdShippingMethod.code : '',
			_shippingCost	 = rdShippingMethod ? rdShippingMethod.cost : 0;
		
        var orderResult = {
            currency: order.currency,
            TVA: TVA,
            user: user ? (user.last_name + user.first_name) : order.billingEmail,
        	orderID: order.orderID,
            success: true,
            guid: order.guid,
            paymentMethod: rdPaymentMethod.code,
            paymentMethodName: rdPaymentMethod.name,
            items: [],
            subtotal: 0,
            total: 0,
            discount: 0,
            shipping: _shippingCost,
            shippingMethod: rdShippingMethod ? rdShippingMethod.name : '',
            shippingEmail: order.shippingEmail || '',
            billingEmail: order.billingEmail || '',
            orderDate: order.createDate.toDateString(),
            confirmEmail: ''
            // currencySymbol: '$'
        }
        
        for (let v in cart) {
	    	let product;
	    	let item = cart[v];
    		product = getProductDetail(v, item);
	    	
	    	if (product) {
	    		orderResult.subtotal += ( product.total || 0);
				product.discount = 0;
	        	orderResult.items.push(product);
		        
		        // Append details
	            let orderDetail = order.orderDetail.append();
	            orderDetail.productGUID = product.guid;
	            orderDetail.sku = product.sku;
	            orderDetail.quantity = product.qty;
	            orderDetail.unitPrice = product.price;
	            
	            product.orderDetailsGUID = orderDetail.guid; // cache order details
	            // orderDetail.points = product.price * 10;
	    	}
	    }
		
		// Apply promotion code
	    var rdPromotion = checkPromotionCode(data.promotionCode);
	    var orderTVA = TVA;
	    
	    if (rdPromotion && rdPromotion.allProduct) {
        	order.promotionGUID = rdPromotion.guid;
        	rdPromotion.activation = rdPromotion.activation + 1;
        	
        	if (rdPromotion.promotionType == promotionTypes.cart_discount) {
        		if (rdPromotion.discountType == '%') {
	        		orderResult.items.forEach((product) => {
		        		let discount = (product.price * rdPromotion.value) / 100;
	        			product.discount = discount;
	        			product.price = product.price - discount;
	        			product.total = product.price * product.qty;
	        			
	        			orderResult.discount += product.discount * product.qty;
		        	});
	        	} else {
	        		// divided equally for all products
	        		let discountTotal = rdPromotion.value;
	        		orderResult.items.forEach((product) => {
	        			let discount = 0;
	        			if (rdPromotion.value < orderResult.subtotal) {
		        			if (discountTotal >= product.total) {
		        				discountTotal = discountTotal - product.total;
		        				discount = product.total/product.qty;
		        			} else {
		        				discount = discountTotal/product.qty;
		        				discountTotal = 0;
		        			}
	        			} else {
	        				discount = product.price;
	        			}
		        		
	        			product.discount = discount;
	        			product.price = product.price - discount;
	        			product.total = product.price * product.qty;
	        			orderResult.discount += discount * product.qty;
		        	});
	        	}
	        	
	        	orderResult.subtotal = orderResult.subtotal - orderResult.discount;
        	} else if (rdPromotion.promotionType == promotionTypes.tax_discount) {
        		var totalTAX = orderResult.subtotal * TVA;
        		
        		// Free tax, TVA = 0%
        		if (rdPromotion.free) {
        			orderTVA = 0;
        			orderResult.discount += totalTAX;
        		} else {
        			// % discount for the tax  (e.g.  10% Tax discount ) 
        			if (rdPromotion.discountType == '%') {
        				var taxDiscount = ((rdPromotion.value / 100) * TVA );
        				
	        			orderTVA = TVA - taxDiscount;
	        			orderResult.discount += orderResult.subtotal * taxDiscount;
        			
        			// Flat amount adjustment  (e.g. Tax have $5 adjustment )
	        		} else {
	        			// if Tax adjustment > total tax
	        			if (rdPromotion.value > totalTAX) {
	        				orderTVA = 0;
        					orderResult.discount += totalTAX;
	        			} else {
	        				var taxDiscount = rdPromotion.value * 100 / totalTAX; // tax discount in percent(%)
	        				
	        				taxDiscount = ((taxDiscount / 100) * TVA );
	        				orderTVA = TVA - taxDiscount;
	        				orderResult.discount += rdPromotion.value;
	        			}
	        		}
        		}
        	} else if (rdPromotion.promotionType == promotionTypes.shipping_discount && orderResult.shipping > 0) {
        		// free shipping
        		let discount = 0;
        		
        		if (rdPromotion.free) {
        			discount = orderResult.shipping;
        			orderResult.shipping = 0;
        		} else {
        			// discount shipping by %
    				if (rdPromotion.discountType == '%') {
	        			discount = (orderResult.shipping * rdPromotion.value) / 100;
	        			
        			// discount shipping by amount
	        		} else {
	        			if (rdPromotion.value > orderResult.shipping) {
	        				discount = orderResult.shipping;
	        			} else {
	        				discount = rdPromotion.value;
	        			}
	        		}
	        		orderResult.shipping = orderResult.shipping - discount;
        		}
        		
        		orderResult.discount += discount;
        	}
        }
        
		// Subtotal in database should not include vat
        order.subTotal = orderResult.subtotal;
        
		// var countryCode = order.shippingCountry;
		// var stateCode = order.shippingState;
		// var VAT = tax.getTax(stateCode, countryCode);
		
		// Apply tax
		let totalTVA = 0;
		let totalPoints = 0;
		
		orderResult.subtotal = 0;
        orderResult.items.forEach((product) => {
        	let proVat = product.price * orderTVA;
        	
        	totalTVA += proVat * product.qty;
			
			product.price = product.price + proVat;
			product.price = round(product.price);
			product.total = round(product.price * product.qty);
			
			let orderDetail = order.orderDetail.getRecordByPrimaryKey(product.orderDetailsGUID);
				orderDetail.unitPrice = product.unitPrice;
				
			delete product.unitPrice;
			
			orderDetail.points =  product.total * 10;
			totalPoints += orderDetail.points;
			orderResult.subtotal = (orderResult.subtotal * 10 + product.total * 10) / 10;
        });
		
        // and points
        if (user) {
        	var rdUser =context.user.getRecordByPrimaryKey(user.guid);
        	rdUser.points = (rdUser.points || 0) + totalPoints;
        }
		
        // Subtotal in result include vat to pass paypal
        // orderResult.discount = round(orderResult.discount);
		// orderResult.subtotal = orderResult.subtotal + orderResult.subtotal * orderTVA; // round(orderResult.subtotal + orderResult.subtotal * orderTVA);
        orderResult.subtotal = round(orderResult.subtotal);
        orderResult.total = orderResult.subtotal + orderResult.shipping; // round(orderResult.subtotal + orderResult.shipping);
        orderResult.TVA = totalTVA;
        orderResult.orderID = order.orderID;
		
        order.total = orderResult.total;
        order.discount = orderResult.discount;
        order.TVA = orderResult.TVA;
        order.shippingMethod = _shippingMethod;
        order.shippingCost = orderResult.shipping;
        
        context.save();
        return response.end(orderResult);
    }  else {
        response.end({success: false});
    }
    
    //***************************************************************************************************	
	//Get Cart Detail 
	//***************************************************************************************************	
	function getProductDetail(product_guid, cartItem) {
		var rtn = {
			price: 0,
			special_price: 0,
			guid: product_guid,
			qty: cartItem.qty,
			unitPrice: 0,
			total: 0
		};
		var attribute_list = '("display_name","price_retail","price_special")';
		
		/*
		rtn["name"]				 = "";		//Product Name 
		rtn["description"]		 = "";		//Product Description (default)
		rtn["desc_extra"]		 = "";		//Product Descripiont Extra
		rtn["age_range"]		 = "";		//Product Age range
		rtn["learn_more"]		 = "";		//Product Learn More 
		rtn["battery"]			 = [];		//Product Battery
		rtn["warning"]			 = [];		//Prodcut Warning
		rtn["videos"]			 = "";		//Product Videos
		rtn["videos_img"]		 = "";		//Product Videos Image
		rtn["price"]			 = "";		//Product Price (Retail)
		rtn["special_price"]	 = "";		//Prdouct Price (Special)
		rtn["stock"]			 = 1;		//Product Stock - 0:no stock; 1:stock availiable; Default:0; [TODO]
		rtn["promo_title"]		 = "";		//Product Poromotion Title
		rtn["promo_banner"]		 = "";		//Product Banner
		rtn["promo_banner_url"]	 = [];		//Product Banner link
		rtn["model_title"]		 = [];		//Product Model Title
		rtn["model_url"]		 = [];		//Product Model Url		
		rtn["edu_con_icon"]		 = [];		//Product Education Contributions Icon
		rtn["edu_con_desc"]		 = [];		//Product Education Contributions Description
		rtn["award_badges_icon"] = "";		//Product Award Icon
		rtn["award_badges_url"]	 = "";		//Product Award Url
		rtn["images"]			 = [];		//Product Image
		rtn["id"]				 = "";		//Product Id
		rtn["max_quantity"]		 = 10;					//Product Max Quantity
		rtn["guid"]	= product_guid;		//Product guid
		rtn["qty"]	= cartItem.qty;		//Cart Quantity
		*/
		
		var strSQL	
			= "select attribute_code, attribute_datatype, attribute_values1, attribute_values2, attribute_guid, attribute_value_guid "
			+ "  from pim_product_attribute_values_v "
			+ "  where product_guid=? "
			+ "   and pm_bu_code=? "
			+ "   and attribute_code in " + attribute_list
			+ " order by attribute_code, row_seq ";
		
		var details = context.execSQL(strSQL, [product_guid,bu_code]);
		
		if (details && details.length > 0) {
			for (var i=0; i<details.length; i++) {
				var detail = details[i];
				var value = getLangValue(detail["attribute_values1"],lang);
				var value2 = getLangValue(detail["attribute_values2"],lang);
				
				switch(detail["attribute_code"]) { 
	
					//Display name
					case "display_name": { 
						rtn["name"]=value;
						break; 
					} 
	
					//Retail Price
					case "price_retail": { 
						rtn["price"]= parseFloat(value); // round(value);
						break; 
					} 		
					
					//Special Price
					case "price_special": { 
						rtn["special_price"]= parseFloat(value); //round(value);
						break; 
					} 	
				}
				
				var price = rtn.special_price || rtn.price || 0;
				
				rtn.price = price;
				rtn.unitPrice = price;
				rtn.total = rtn.price * rtn["qty"];
			}
		}
		
		strSQL
		= "	select guid, product_number "
		+ "	from pim_product_master a "
		+ " where exists (select 1 from pim_product_attribute_values_v b where a.guid=b.product_guid and b.attribute_code='web_active' and b.attribute_values1=1) "
		+ " and ifnull(deleted, 0)=0"
		+ " and guid=?"
		+ " and bu_code=?";
		
		var products = context.execSQL(strSQL, [product_guid,bu_code]);
	
		if (products && products.length > 0) {
			rtn["id"]=products[0]['product_number'];		//Product Id
		}
		return rtn;
	}
	
	
	//***************************************************************************************************	
	// Check Promotion Code
	//***************************************************************************************************	
	function checkPromotionCode(promoCode) {
		if (!promoCode) return null;
		context.productPromotion.reset();
		context.productPromotion.query.where.code.equal(promoCode);
		context.productPromotion.orderBy.modifyDate.desc;
		context.productPromotion.fetchRecords();
		
		var rd = context.productPromotion.first;
		var currDate = new Date();
		// return valid promotion code
		if (rd && !rd.disabled && (rd.activation || 0) < (rd.maxActivation == undefined ? 1000000: rd.maxActivation) 
			&& (!rd.startDate || rd.startDate <= currDate) && (!rd.endDate || rd.endDate >= currDate)) {
			return rd;
		// invalid promotion code
		} else {
			return null;
		}
	}
}

//***************************************************************************************************	
//Get Lang value
//***************************************************************************************************	
function getLangValue(value, input_lang) {
	if(input_lang){
	  lang = input_lang;	
	} 
	
	if (value) {
		if (typeof value == "string") {
	        try {
	            var obj = JSON.parse(value);

	            var retValue = value;
	            if ((value.indexOf('{') > -1) && obj) {
			        if (obj.hasOwnProperty(lang)) {
			            retValue = obj[lang];
			        } else {
			        	for (var i=0; i<bu_languages.length; i++) {
			        		var code = bu_languages[i].code;

			        		if ((code != lang) && obj.hasOwnProperty(code)) {
				        		retValue = obj[code];
				        		break;
			        		}
				        }
			        }
	            }

		        return retValue;
	        } catch (e) {
	            return value;
	        }
		}
	} else {
		return "";
	}
}

function round(num, decimal) {
	decimal = decimal || 2;
	var factor = Math.pow(10, decimal);
	return Math.round(num * factor)/factor;
}

function OrderNumber_Generator(){ 
    var length = 8;               //Order ID Length 
	var timestamp = +new Date;     
	
	//Get Random Interger 
	var _getRandInt = function( min, max ) { 
	    return Math.floor( Math.random() * ( max - min + 1 ) ) + min; 
	} 
	
	var ts = timestamp.toString(); 
	var parts = ts.split( "" ).reverse(); 
	var id = ""; 
	      
	for( var i = 0; i < length; ++i ) { 
	    var index = _getRandInt( 0, parts.length - 1 ); 
	    id += parts[index];         
	} 
	return id; 
};