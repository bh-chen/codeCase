/** cart */
function cartRequest(session, request, response, params) {
    // get cart
    let cart;
    try {
        cart = JSON.parse(request.cookie['cart_items'] || null);
    } catch(e) {
        cart = null;
    }
    if (!cart) {
        return {
            success: false,
            error: 'empty cart'
        }
    }

    const result = {
        total: 0,
        subTotal: 0,
        sku: [],
        product: []
    }

    for (let v in cart) {
        let item = cart[v];
        let product = getNormalProduct(item, v);

        if (!product) {
            continue;
        }

        result.total = result.total + product.total;
        result.subTotal = result.total;
        result.product.push(product);
    }

    result.subTotal = result.total;
    return result;
}

function getNormalProduct(item, itemId) {
    let skuID;
    let context;
    let productGUID;

    if (itemId.indexOf('$') > -1) {
        let _id = itemId.split('$');
        skuID = _id[1];
        productGUID = _id[0];
    } else {
        productGUID = itemId;
    }

    context = productMaster.query.where.guid.equal(productGUID);
    let  rdProduct = context[0];
    if (!rdProduct) {
        return null;
    }

    // get images
    rdProduct = productImage.query.where.guid.equal(rdProduct.imageGUID);
    rdProduct.sort(function(r1, r2) {
        if (r1.ordering > r2.ordering) {
            return 1;
        } else if (r1.ordering < r2.ordering) {
            return -1;
        } else {
            return 0;
        }
    })

    let product;
    if (skuID) {
        context = productSKU.query.where.guid.equal(skuId).and.productGUID.equal(productGUID).and.active.equal(true).and.priceAdj.greaterThan(0);
        let rdSKU = context.productSKU[0];

        if (rdSKU) {
            let price = rdProduct.price + (rdSKU.priceAdj || 0);
            let specialPrice = rdProduct.specialPrice ? rdProduct.specialPrice + (rdSKU.priceAdj || 0) : 0;

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
	            image: rdProduct.defaultImage ? rdProduct.defaultImage.url : '',
	            img: rdProduct.defaultImage.url,
	            price: price,
	            specialPrice: specialPrice,
	            qty: item.qty,
	            total: item.qty * (specialPrice ? specialPrice : price)
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
        image: rdProduct.defaultImage ? rdProduct.defaultImage.url : '',
        price: rdProduct.price,
        specialPrice: rdProduct.specialPrice,
        qty: item.qty,
        total: item.qty * (rdProduct.specialPrice ? rdProduct.specialPrice : rdProduct.price)
    }

    return product;
}

/** cart total */
function cartTotalRequest(session, request, response, params) {
    const ICheckoutInfo = {
        shippingMethod: '',
        paymentMethod: '',
        promotionCode: ''
    }    
    const IOrder = {
        success: null,
        currency: '',
        items: [],
        subtotal: null,
        total: null,
        discount: null,
        shipping: null,
        shippingMethod: '',
        TVA: null,
        promotion: null
    }
    
    let cart;
    let context;
    let lang = "fr"; //session.lang.code;
    let bu_code = "vtefr";    
    let target = "cart";    
	let strSQL = "";
	let TVA = 0.2;
    let bu_languages = [];
    let promotionTypes = {
        cart_discount:		{ code: 'cart_discount',	 name: 'Whole cart discount' },
        tax_discount:		{ code: 'tax_discount', 	 name: 'Tax (TVA) discount'  },
        shipping_discount:	{ code: 'shipping_discount', name: 'Shipping Discount'   }
    }
    let data = ICheckoutInfo;

    if (request.method == 'GET') {
        try {
            let cart = JSON.parse(request.cookie['cart_items'] || null);
            let promotion = JSON.parse(request.cookie['cart_promotion'] || null);

            if (promotion) {
                data.promotionCode = promotion.promoCode;
            }
        } catch(e) {
            cart = null;
        }
    } else {
        return {
            success: false
        }
    }

    if (!cart) {
        return {
            success: false,
            error: 'empty cart'
        }
    }

    let rdShippingMethod;
    if (data.shippingMethod) {
        context = shippingMethod.query.where.code.equal(data.shippingMethod);

        rdShippingMethod = context[0];
    }


}

/**
 * 重写js Number的toFixed()
 * @param {Number} d 保留几位小数
 * @param {Number} n 要处理的数据
 * @returns {string}
 **/
function toFixed(number, length) {
    let carry = 0; //存放进位标志
    let num, multiple; //num为原浮点数放大multiple倍后的数，multiple为10的length次方
    let str = number + ''; //将调用该方法的数字转为字符串
    let dot = str.indexOf("."); //找到小数点的位置
    if (str.substr(dot + length + 1, 1) >= 5) carry = 1; //找到要进行舍入的数的位置，手动判断是否大于等于5，满足条件进位标志置为1
    multiple = Math.pow(10, length); //设置浮点数要扩大的倍数
    num = Math.floor(number * multiple) + carry; //去掉舍入位后的所有数，然后加上我们的手动进位数
    let result = num / multiple + ''; //将进位后的整数再缩小为原浮点数
    /*
     * 处理进位后无小数
     */
    dot = result.indexOf(".");
    if (dot < 0) {
        result += '.';
        dot = result.indexOf(".");
    }
    /*
     * 处理多次进位
     */
    let len = result.length - (dot + 1);
    if (len < length) {
        for (let i = 0; i < length - len; i++) {
            result += 0;
        }
    }
    return result;
}