package youzan

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
	"github.com/zhoukaidong/senior-buyer-go/internal/domain/model"
)

// Buyer implements the Youzan buyer functionality
type Buyer struct {
	model.BaseBuyer
	config *model.YouzanBuyerConfig
	client *fasthttp.Client
	mu     sync.RWMutex
}

// NewBuyer creates a new Youzan buyer
func NewBuyer(config *model.YouzanBuyerConfig) *Buyer {
	b := &Buyer{
		config: config,
		client: &fasthttp.Client{
			ReadTimeout:  time.Second * 30,
			WriteTimeout: time.Second * 30,
		},
		BaseBuyer: model.BaseBuyer{
			Name:     config.ShopName, // Use shop_name as buyer name
			Disabled: config.Disabled,
		},
	}
	return b
}

// QueryCart queries the shopping cart for this buyer
func (b *Buyer) QueryCart() (*model.CartResult, error) {
	log.Printf("[%s] 查询购物车...", b.GetName())

	// Get public IP first
	clientIP, err := b.queryPublicIP()
	if err != nil {
		log.Printf("[%s] 获取公网IP失败: %v", b.GetName(), err)
		clientIP = "127.0.0.1" // Fallback
	}

	result, err := b.fetchAPI(fmt.Sprintf("https://shop%d.youzan.com/wsctrade/cartGoodstList.json", b.config.KdtID), map[string]string{
		"kdt_id":                 strconv.FormatInt(b.config.KdtID, 10),
		"store_id":               "0",
		"supportReviveGroup":     "true",
		"supportCombo":           "true",
		"excludedComboSubType":   "[]",
		"disableSearchYzGuarantee": "true",
	})
	if err != nil {
		log.Printf("[%s] 查询购物车时出错: %v", b.GetName(), err)
		return nil, err
	}

	// Parse result
	resultMap, ok := result.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid response format")
	}

	data, ok := resultMap["data"].([]interface{})
	if !ok || len(data) == 0 {
		log.Printf("[%s] 购物车为空", b.GetName())
		return &model.CartResult{
			BuyerName:  b.GetName(),
			OrderTotal: 0,
			List:       []model.CartItem{},
		}, nil
	}

	firstShop, ok := data[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid shop data format")
	}

	itemsRaw, ok := firstShop["items"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid items format")
	}

	// Convert items
	items := b.parseCartItems(itemsRaw)

	if len(items) > 0 {
		b.mu.Lock()
		b.OrderList = b.generateOrderList(items, clientIP)
		b.CombineOrder = b.generateCombineOrder(items, clientIP)
		b.mu.Unlock()
	}

	log.Printf("[%s] 查询购物车 结果: %d 个商品", b.GetName(), len(items))

	// Convert to generic cart items
	var genericItems []model.CartItem
	for _, item := range items {
		genericItems = append(genericItems, model.CartItem{
			ItemID:      strconv.FormatInt(item.GoodsID, 10),
			ItemName:    item.Title,
			SkuID:       strconv.FormatInt(item.SkuID, 10),
			Count:       item.Num,
			Price:       item.PayPrice,
			OriPrice:    item.PayPrice,
			CreatedTime: item.CreatedTime,
			UpdatedTime: item.UpdatedTime,
		})
	}

	return &model.CartResult{
		BuyerName:  b.GetName(),
		OrderTotal: b.GetOrderTotal(),
		List:       genericItems,
	}, nil
}

// QueryPreOrder returns pre-order information
func (b *Buyer) QueryPreOrder() (*model.PreOrderInfo, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	return &model.PreOrderInfo{
		BuyerName:    b.GetName(),
		OrderTotal:   b.GetOrderTotal(),
		OrderList:    b.OrderList,
		CombineOrder: b.CombineOrder,
	}, nil
}

// OrderCart creates orders
func (b *Buyer) OrderCart(combine bool) ([]model.OrderResult, error) {
	b.mu.RLock()
	if len(b.OrderList) < 1 {
		b.mu.RUnlock()
		return []model.OrderResult{{Message: "购物车为空"}}, nil
	}

	if b.HasCombineSucceeded() {
		b.mu.RUnlock()
		return []model.OrderResult{{Message: "已下单成功"}}, nil
	}

	var orderList []model.OrderParams
	if combine {
		orderList = []model.OrderParams{b.CombineOrder}
	} else {
		orderList = b.OrderList
	}
	b.mu.RUnlock()

	log.Printf("[%s] 购物车结算...", b.GetName())

	// Process in batches of 2
	batchSize := 2
	var results []model.OrderResult

	for i := 0; i < len(orderList); i += batchSize {
		end := i + batchSize
		if end > len(orderList) {
			end = len(orderList)
		}

		batch := orderList[i:end]
		batchResults := b.processBatch(batch)
		results = append(results, batchResults...)
	}

	return results, nil
}

// processBatch processes a batch of orders concurrently
func (b *Buyer) processBatch(batch []model.OrderParams) []model.OrderResult {
	var wg sync.WaitGroup
	results := make([]model.OrderResult, len(batch))

	for i, order := range batch {
		wg.Add(1)
		go func(idx int, ord model.OrderParams) {
			defer wg.Done()
			results[idx] = b.createOrder(ord)
		}(i, order)
	}

	wg.Wait()
	return results
}

// createOrder creates a single order
func (b *Buyer) createOrder(orderInfo model.OrderParams) model.OrderResult {
	log.Printf("[%s] 创建订单... %s %s", b.GetName(), orderInfo.SubmitID, orderInfo.ItemName)

	b.mu.RLock()
	alreadySucceeded := b.IsSucceded(orderInfo.SubmitID)
	b.mu.RUnlock()

	if alreadySucceeded {
		log.Printf("[%s] 已下单成功，跳过... %s", b.GetName(), orderInfo.SubmitID)
		return model.OrderResult{
			SubmitID:  orderInfo.SubmitID,
			ItemName:  orderInfo.ItemName,
			Status:    "success",
			Message:   "已下单成功",
			BuyerName: b.GetName(),
		}
	}

	log.Printf("[%s] 开始下单... %s", b.GetName(), orderInfo.SubmitID)

	url := fmt.Sprintf("https://cashier.youzan.com/pay/wsctrade/order/buy/v2/bill-fast.json?kdt_id=%d", b.config.KdtID)
	result, err := b.fetchAPI(url, orderInfo.OrderParam)

	log.Printf("[%s] 下单结果: %v", b.GetName(), result)

	if err == nil {
		// Check if order was successful
		if resultMap, ok := result.(map[string]interface{}); ok {
			if data, ok := resultMap["data"].(map[string]interface{}); ok {
				if _, exists := data["orderNo"]; exists {
					b.mu.Lock()
					b.MarkSucceeded(orderInfo.SubmitID)
					orderInfo.Succeed = true
					b.mu.Unlock()
				}
			}
		}
	}

	return model.OrderResult{
		SubmitID:  orderInfo.SubmitID,
		ItemName:  orderInfo.ItemName,
		Result:    result,
		BuyerName: b.GetName(),
	}
}

// queryPublicIP queries the public IP address
func (b *Buyer) queryPublicIP() (string, error) {
	req := fasthttp.AcquireRequest()
	defer fasthttp.ReleaseRequest(req)

	req.SetRequestURI("https://ifconfig.me/ip")
	req.Header.SetMethod("GET")

	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseResponse(resp)

	if err := b.client.Do(req, resp); err != nil {
		return "", err
	}

	return string(resp.Body()), nil
}

// fetchAPI makes an API request to Youzan
func (b *Buyer) fetchAPI(url string, params interface{}) (interface{}, error) {
	req := fasthttp.AcquireRequest()
	defer fasthttp.ReleaseRequest(req)

	req.SetRequestURI(url)
	req.Header = b.buildHeaders()

	// Handle query parameters
	if queryMap, ok := params.(map[string]string); ok {
		// Add query params to URL
		if strings.Contains(url, "?") {
			url += "&"
		} else {
			url += "?"
		}
		queryParts := make([]string, 0, len(queryMap))
		for k, v := range queryMap {
			queryParts = append(queryParts, fmt.Sprintf("%s=%s", k, v))
		}
		req.SetRequestURI(url + strings.Join(queryParts, "&"))
	} else if orderParam, ok := params.(model.OrderParams); ok {
		// POST request with order params
		req.Header.SetMethod("POST")
		req.Header.SetContentType("application/json")

		body, err := json.Marshal(orderParam.OrderParam)
		if err != nil {
			return nil, err
		}
		req.SetBody(body)
	} else if paramMap, ok := params.(map[string]interface{}); ok {
		// POST request with map params
		req.Header.SetMethod("POST")
		req.Header.SetContentType("application/json")

		body, err := json.Marshal(paramMap)
		if err != nil {
			return nil, err
		}
		req.SetBody(body)
	}

	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseResponse(resp)

	if err := b.client.Do(req, resp); err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	var result interface{}
	if err := json.Unmarshal(resp.Body(), &result); err != nil {
		return nil, err
	}

	return result, nil
}

// buildHeaders builds HTTP headers for Youzan API
func (b *Buyer) buildHeaders() fasthttp.RequestHeader {
	var header fasthttp.RequestHeader
	header.Set("Accept", "application/json, text/plain, */*")
	header.Set("Accept-Language", "zh-CN,zh;q=0.9,zh-TW;q=0.8")
	header.Set("Content-Type", "application/json")
	header.Set("Cookie", b.config.Cookie)
	header.Set("Extra-Data", `{"sid":"","version":"","bizEnv":""}`)
	header.Set("Page-Path", "https://tuicashier.youzan.com/wsctrade/cart")
	header.Set("Sec-Fetch-Dest", "empty")
	header.Set("Sec-Fetch-Mode", "cors")
	header.Set("Sec-Fetch-Site", "same-site")
	header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1")
	return header
}

// parseCartItems parses cart items from API response
func (b *Buyer) parseCartItems(itemsRaw []interface{}) []model.YouzanCartItem {
	items := make([]model.YouzanCartItem, 0)

	for _, itemRaw := range itemsRaw {
		itemMap, ok := itemRaw.(map[string]interface{})
		if !ok {
			continue
		}

		item := model.YouzanCartItem{}

		if goodsID, ok := itemMap["goods_id"].(float64); ok {
			item.GoodsID = int64(goodsID)
		}
		if skuID, ok := itemMap["sku_id"].(float64); ok {
			item.SkuID = int64(skuID)
		}
		if num, ok := itemMap["num"].(float64); ok {
			item.Num = int(num)
		}
		if title, ok := itemMap["title"].(string); ok {
			item.Title = title
		}
		if payPrice, ok := itemMap["pay_price"].(float64); ok {
			item.PayPrice = payPrice
		}
		if createdTime, ok := itemMap["created_time"].(float64); ok {
			item.CreatedTime = int64(createdTime)
		}
		if updatedTime, ok := itemMap["updated_time"].(float64); ok {
			item.UpdatedTime = int64(updatedTime)
		}
		if activityID, ok := itemMap["activity_id"].(float64); ok {
			item.ActivityID = int64(activityID)
		}
		if activityType, ok := itemMap["activity_type"].(float64); ok {
			item.ActivityType = int(activityType)
		}
		if kdtID, ok := itemMap["kdt_id"].(float64); ok {
			item.KdtID = int64(kdtID)
		}
		if deliverTime, ok := itemMap["deliver_time"].(float64); ok {
			item.DeliverTime = int64(deliverTime)
		}
		if cartID, ok := itemMap["cart_id"].(string); ok {
			item.CartID = cartID
		}

		items = append(items, item)
	}

	return items
}

// generateOrderList generates order parameters for individual items
func (b *Buyer) generateOrderList(items []model.YouzanCartItem, clientIP string) []model.OrderParams {
	orderParamsList := make([]model.OrderParams, 0)

	for _, item := range items {
		orderParams := b.buildOrderParams([]model.YouzanCartItem{item}, clientIP)
		orderParamsList = append(orderParamsList, model.OrderParams{
			SubmitID:  b.UUID(),
			ItemName:  item.Title,
			OrderParam: orderParams,
		})
	}

	return orderParamsList
}

// generateCombineOrder generates combined order parameters
func (b *Buyer) generateCombineOrder(items []model.YouzanCartItem, clientIP string) model.OrderParams {
	orderParams := b.buildOrderParams(items, clientIP)

	return model.OrderParams{
		SubmitID:  "combine",
		ItemName:  "聚合商品",
		OrderParam: orderParams,
	}
}

// buildOrderParams builds order parameters for Youzan
func (b *Buyer) buildOrderParams(items []model.YouzanCartItem, clientIP string) map[string]interface{} {
	// Build item sources
	itemSources := make([]map[string]interface{}, 0)
	for _, item := range items {
		itemSources = append(itemSources, map[string]interface{}{
			"activityId": item.ActivityID,
			"activityType": item.ActivityType,
			"bizTracePointExt": `{"atr_uuid":"","yzk_ex":"","page_type":"","tui_platform":"","tui_click":"","wecom_uuid":"","from_source":"","pv_id":"/v2/showcase/homepage~ce2462ee-fa92-4487-a00f-0cdcd6ec88c0","banner_id":"cart.118622541~recService.1~1~j9NzLTY4","st":"js","sv":"1.1.49","yai":"wsc_c","uuid":"6a3b3b3f-3607-7659-bed3-08e4b81bb087","userId":"","platform":"web","alg":"common_by_shop.store_ctr_30d_1000.0:20251225,common_by_shop.inner_hot.2:20251224,common_by_shop.inner_price_hot.0:20251224,common_by_shop.inner_7d_hot.0:20251224,common_by_shop.inner_1d_hot.0:20251224,cold_simple_rank,0.0.0.0.0.0.0.0.0_2b0e9eebd35d486c8a6927189f3850d7","alias":"3ex44eto5dcbx6i"}`,
			"cartCreateTime": 0,
			"cartUpdateTime": 0,
			"goodsId": item.GoodsID,
			"propertyIds": []interface{}{},
			"skuId": item.SkuID,
		})
	}

	// Build items
	builtItems := make([]map[string]interface{}, 0)
	totalPrice := 0.0

	for _, item := range items {
		itemTotal := item.PayPrice * float64(item.Num)
		totalPrice += itemTotal

		builtItems = append(builtItems, map[string]interface{}{
			"activityId": item.ActivityID,
			"activityType": item.ActivityType,
			"deliverTime": 0,
			"extensions": map[string]interface{}{
				"OUTER_ITEM_ID": "10000",
			},
			"goodsId": item.GoodsID,
			"isSevenDayUnconditionalReturn": true,
			"itemFissionTicketsNum": 0,
			"itemMessage": "{}",
			"kdtId": b.config.KdtID,
			"num": item.Num,
			"pointsPrice": 0,
			"price": item.PayPrice,
			"propertyIds": []interface{}{},
			"skuId": item.SkuID,
			"storeId": 0,
			"umpSkuId": 0,
		})
	}

	// Build activities
	activities := make([]map[string]interface{}, 0)
	for _, item := range items {
		activities = append(activities, map[string]interface{}{
			"activityAlias": "",
			"activityId": item.ActivityID,
			"activityType": item.ActivityType,
			"externalPointId": 0,
			"goodsId": item.GoodsID,
			"kdtId": b.config.KdtID,
			"pointsPrice": 0,
			"propertyIds": []interface{}{},
			"skuId": item.SkuID,
			"usePoints": false,
		})
	}

	// Build order params
	orderParams := map[string]interface{}{
		"version": 2,
		"source": map[string]interface{}{
			"bookKey": b.UUID(),
			"clientIp": clientIP,
			"fromThirdApp": false,
			"isWeapp": false,
			"itemSources": itemSources,
			"kdtSessionId": b.config.KdtSessionID,
			"needAppRedirect": false,
			"orderType": 0,
			"platform": "weixin",
			"salesman": "",
			"userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
			"orderMark": "",
			"bizPlatform": "",
		},
		"config": map[string]interface{}{
			"bosWorkFlow": false,
			"containsUnavailableItems": false,
			"fissionActivity": map[string]interface{}{
				"fissionTicketNum": 0,
			},
			"isFromItemDetail": true,
			"paymentExpiry": 0,
			"receiveMsg": true,
			"usePoints": false,
			"useWxpay": false,
			"buyerMsg": "",
			"disableStoredDiscount": false,
			"storedDiscountRechargeGuide": true,
			"isWholesaleOrder": false,
			"valueCardsExtContext": `{"IS_RELOAD":false,"CUSTOMER_SELECT_CARD_LIST":false,"SELECTED_RECHARGE_FREE_PRODUCT":false,"DIY_SELECT_CARDS":"0"}`,
		},
		"usePayAsset": map[string]interface{}{},
		"items": builtItems,
		"seller": map[string]interface{}{
			"kdtId": b.config.KdtID,
			"storeId": 0,
		},
		"ump": map[string]interface{}{
			"activities": activities,
			"coupon": map[string]interface{}{},
			"multiCoupon": map[string]interface{}{
				"coupons": []interface{}{},
				"deliveryCoupons": []interface{}{},
			},
			"useCustomerCardInfo": map[string]interface{}{
				"specified": false,
			},
			"costPoints": map[string]interface{}{
				"kdtId": b.config.KdtID,
				"usePointDeduction": false,
				"costPoints": 0,
				"defaultPointDeductEffect": true,
			},
		},
		"newCouponProcess": true,
		"unavailableItems": []interface{}{},
		"asyncOrder": false,
		"delivery": map[string]interface{}{
			"hasFreightInsurance": true,
			"address": b.config.Address,
			"expressType": "express",
			"expressTypeChoice": 0,
		},
		"cloudOrderExt": map[string]interface{}{
			"extension": map[string]interface{}{},
		},
		"bookKeyCloudExtension": map[string]interface{}{
			"umpExt": "",
		},
		"confirmTotalPrice": totalPrice,
		"extensions": map[string]interface{}{
			"CONFIRM_TRADE_RISK_DIALOG": "false",
			"TRADE_PAGE_TYPE": "TRADE_BUY_PAGE",
			"NEW_MEMBER_FLOW": "true",
			"IS_OPTIMAL_SOLUTION": "true",
			"ATTR_SUPPORT_TIMESPAN_DELIVERY_FEE": "1",
			"IS_OVERLYING_COUPON": "true",
			"IS_SELECT_PRESENT": "0",
			"NOT_SALE_SINGLE": "1",
			"SELECTED_PRESENTS": "[]",
			"BIZ_ORDER_ATTRIBUTE": `{"RISK_GOODS_TAX_INFOS":"0"}`,
			"ATTR_SOURCE_PAGE": "goods_detail",
			"USE_OPTIMAL_CALCULATE": "1",
		},
		"behaviorOrderInfo": map[string]interface{}{
			"bizType": 158,
			"token": "",
		},
	}

	return orderParams
}
