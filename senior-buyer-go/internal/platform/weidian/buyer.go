package weidian

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/valyala/fasthttp"
	"github.com/zhoukaidong/senior-buyer-go/internal/domain/model"
)

// Buyer implements the Weidian buyer functionality
type Buyer struct {
	model.BaseBuyer
	config *model.WeidianBuyerConfig
	client *fasthttp.Client
	mu     sync.RWMutex
}

// NewBuyer creates a new Weidian buyer
func NewBuyer(config *model.WeidianBuyerConfig) *Buyer {
	b := &Buyer{
		config: config,
		client: &fasthttp.Client{
			ReadTimeout:  time.Second * 30,
			WriteTimeout: time.Second * 30,
		},
		BaseBuyer: model.BaseBuyer{
			Name:     config.BuyerName,
			Disabled: config.Disabled,
		},
	}
	return b
}

// QueryCart queries the shopping cart for this buyer
func (b *Buyer) QueryCart() (*model.CartResult, error) {
	log.Printf("[%s] 查询购物车...", b.GetName())

	htmlText, err := b.fetchWeidianAPI("https://weidian.com/new-cart/index.php", &fasthttp.Request{
		Header: b.buildHeaders("text/html"),
	}, map[string]string{
		"referrerURl": fmt.Sprintf("shopid_%s", b.config.ShopID),
		"pageName":    "shop_menu_cart",
		"wfr":         "wxBuyerShare",
	})
	if err != nil {
		log.Printf("[%s] 查询购物车时出错: %v", b.GetName(), err)
		return nil, err
	}

	// Extract data from HTML
	dataStr, err := b.extractDataObjFromHtml(htmlText)
	if err != nil {
		log.Printf("[%s] 解析购物车数据时出错: %v", b.GetName(), err)
		return nil, err
	}

	// Parse cart data
	var cartData struct {
		Cart struct {
			Result struct {
				Shops []model.WeidianShopGroup `json:"shops"`
			} `json:"result"`
		} `json:"cart"`
	}

	if err := json.Unmarshal([]byte(dataStr), &cartData); err != nil {
		log.Printf("[%s] 解析购物车JSON时出错: %v", b.GetName(), err)
		return nil, err
	}

	shops := cartData.Cart.Result.Shops
	log.Printf("[%s] 查询购物车 结果: %d 个店铺", b.GetName(), len(shops))

	// Generate order parameters if cart is not empty
	if len(shops) > 0 {
		b.mu.Lock()
		b.OrderList = b.generateOrderParamsFromCart(shops)
		b.CombineOrder = b.generateCombineOrder(shops)
		b.mu.Unlock()
	}

	// Convert to generic cart items
	var items []model.CartItem
	for _, shop := range shops {
		for _, partition := range shop.Partitions {
			for _, item := range partition.ItemList {
				price, _ := strconv.ParseFloat(item.Price, 64)
				oriPrice, _ := strconv.ParseFloat(item.OriPrice, 64)
				items = append(items, model.CartItem{
					ItemID:      item.ItemID,
					ItemName:    item.ItemName,
					SkuID:       strconv.FormatInt(item.SkuID, 10),
					Count:       item.Count,
					Price:       price,
					OriPrice:    oriPrice,
					CreatedTime: time.Now().UnixMilli(),
					UpdatedTime: time.Now().UnixMilli(),
				})
			}
		}
	}

	return &model.CartResult{
		BuyerName:  b.GetName(),
		OrderTotal: b.GetOrderTotal(),
		List:       items,
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
	log.Printf("[%s] 创建订单... %s", b.GetName(), orderInfo.SubmitID)

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

	result, err := b.fetchWeidianAPI("https://thor.weidian.com/vbuy/CreateOrder/1.0", &fasthttp.Request{
		Header: b.buildHeaders("application/json"),
		Method: fasthttp.MethodPost,
	}, orderInfo.OrderParam)

	log.Printf("[%s] 下单结果: %v", b.GetName(), result)

	if err == nil {
		// Check if order was successful
		if resultMap, ok := result.(map[string]interface{}); ok {
			if status, ok := resultMap["status"].(map[string]interface{}); ok {
				if code, ok := status["code"].(float64); ok && code == 0 {
					if msg, ok := status["message"].(string); ok && msg == "OK" {
						b.mu.Lock()
						b.MarkSucceeded(orderInfo.SubmitID)
						orderInfo.Succeed = true
						b.mu.Unlock()
					}
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

// fetchWeidianAPI makes an API request to Weidian
func (b *Buyer) fetchWeidianAPI(url string, req *fasthttp.Request, params interface{}) (interface{}, error) {
	// Build URL with query params if params is a map
	if queryMap, ok := params.(map[string]string); ok {
		queryParts := make([]string, 0, len(queryMap))
		for k, v := range queryMap {
			queryParts = append(queryParts, fmt.Sprintf("%s=%s", k, v))
		}
		if len(queryParts) > 0 {
			if strings.Contains(url, "?") {
				url += "&" + strings.Join(queryParts, "&")
			} else {
				url += "?" + strings.Join(queryParts, "&")
			}
		}
		req.SetRequestURI(url)
	}

	// Set request body for POST requests
	if req.Method == fasthttp.MethodPost {
		if orderParam, ok := params.(map[string]interface{}); ok {
			// Convert to form-encoded data
			formData := b.buildFormData(orderParam)
			req.SetBodyFormData(formData)
		}
	}

	// Set default headers if not already set
	if req.Header.Len() == 0 {
		req.Header = b.buildHeaders("application/json")
	}

	// Make request
	resp := fasthttp.AcquireResponse()
	defer fasthttp.ReleaseResponse(resp)

	if err := b.client.Do(req, resp); err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	body := resp.Body()
	contentType := string(resp.Header.Peek("Content-Type"))

	if strings.Contains(contentType, "text/html") || strings.Contains(url, ".html") || strings.Contains(url, ".php") {
		return string(body), nil
	}

	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return string(body), nil
	}

	return result, nil
}

// buildFormData converts a map to form data slice
func (b *Buyer) buildFormData(data map[string]interface{}) []fasthttp.Arg {
	// For Weidian, we need to handle nested objects
	// The orderParam structure is: param, context, wdtoken, udc
	args := make([]fasthttp.Arg, 0)

	if param, ok := data["param"].(string); ok {
		args = append(args, fasthttp.Arg{Key: []byte("param"), Value: []byte(param)})
	}
	if context, ok := data["context"].(string); ok {
		args = append(args, fasthttp.Arg{Key: []byte("context"), Value: []byte(context)})
	}
	if wdtoken, ok := data["wdtoken"].(string); ok {
		args = append(args, fasthttp.Arg{Key: []byte("wdtoken"), Value: []byte(wdtoken)})
	}
	if udc, ok := data["udc"].(string); ok {
		args = append(args, fasthttp.Arg{Key: []byte("udc"), Value: []byte(udc)})
	}

	return args
}

// buildHeaders builds HTTP headers for Weidian API
func (b *Buyer) buildHeaders(accept string) fasthttp.RequestHeader {
	var header fasthttp.RequestHeader
	header.Set("Accept", accept)
	header.Set("Accept-Language", "zh-CN,zh;q=0.9,zh-TW;q=0.8")
	header.Set("Cookie", b.config.Cookie)
	header.Set("Origin", "https://weidian.com")
	header.Set("Referer", fmt.Sprintf("https://shop%s.v.weidian.com/", b.config.ShopID))
	header.Set("Sec-Fetch-Dest", "empty")
	header.Set("Sec-Fetch-Mode", "cors")
	header.Set("Sec-Fetch-Site", "same-site")
	header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1")
	return header
}

// extractDataObjFromHtml extracts data from HTML using goquery
func (b *Buyer) extractDataObjFromHtml(htmlText string) (string, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlText))
	if err != nil {
		return "", fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Find the script element with id __rocker-render-inject__
	selection := doc.Find("#__rocker-render-inject__")
	if selection.Length() == 0 {
		return "", fmt.Errorf("script element not found")
	}

	dataObj, exists := selection.Attr("data-obj")
	if !exists {
		return "", fmt.Errorf("data-obj attribute not found")
	}

	return dataObj, nil
}

// generateOrderParamsFromCart generates order parameters for individual items
func (b *Buyer) generateOrderParamsFromCart(cartData []model.WeidianShopGroup) []model.OrderParams {
	orderParamsList := make([]model.OrderParams, 0)

	// Base template
	baseParam := map[string]interface{}{
		"channel":          "bjh5",
		"source_id":        b.config.SourceID,
		"biz_type":         1,
		"deliver_type":     0,
		"is_no_ship_addr":  0,
		"total_vjifen":     "",
		"wfr":              "wxBuyerShare",
		"appid":            "",
		"discount_list":    []interface{}{},
		"invalid_shop_list": []interface{}{},
		"pay_type":         0,
		"buyer": map[string]interface{}{
			"buyer_id":           b.config.BuyerID,
			"eat_in_table_name":  "",
			"address_id":         b.config.AddressID,
			"agreement_type_list": []int{5},
		},
	}

	baseContext := map[string]interface{}{
		"subChannel":    "browser",
		"thirdSubchannel": "safari",
	}

	// Get first shop group ID for shopping_center
	firstShopGroupID := ""
	if len(cartData) > 0 {
		firstShopGroupID = cartData[0].GroupID
	}
	finalContext := make(map[string]interface{})
	for k, v := range baseContext {
		finalContext[k] = v
	}
	finalContext["shopping_center"] = firstShopGroupID

	// Add q_pv_id
	qPVId := b.UUID()
	baseParam["q_pv_id"] = qPVId

	// Process each shop
	for _, shopGroup := range cartData {
		shopID := shopGroup.ShopID

		// Process each partition
		for _, partition := range shopGroup.Partitions {
			// Process each item
			for _, item := range partition.ItemList {
				skuID := strconv.FormatInt(item.SkuID, 10)
				count := item.Count
				price := item.Price
				oriPrice := item.OriPrice

				// Calculate totals
				priceFloat, _ := strconv.ParseFloat(price, 64)
				oriPriceFloat, _ := strconv.ParseFloat(oriPrice, 64)
				currentPrice := fmt.Sprintf("%.2f", priceFloat*float64(count))
				currentOriPrice := fmt.Sprintf("%.2f", oriPriceFloat*float64(count))

				// Build shop list (one item per order)
				shopList := []map[string]interface{}{
					{
						"shop_id":   shopID,
						"f_shop_id": "",
						"sup_id":    "",
						"item_list": []map[string]interface{}{
							{
								"item_id":           item.ItemID,
								"quantity":          count,
								"item_sku_id":       skuID,
								"ori_price":         oriPrice,
								"price":             price,
								"extend":            map[string]interface{}{},
								"price_type":        1,
								"discount_list":     []interface{}{},
								"item_convey_info":  map[string]interface{}{},
							},
						},
						"order_type":        3,
						"ori_price":         currentOriPrice,
						"price":             currentPrice,
						"express_fee":       "0.00",
						"express_type":      4,
						"discount_list":     []interface{}{},
						"invalid_item_list": []interface{}{},
					},
				}

				// Build param
				newParam := make(map[string]interface{})
				for k, v := range baseParam {
					newParam[k] = v
				}
				newParam["shop_list"] = shopList
				newParam["total_pay_price"] = currentPrice

				// Build submission
				paramJSON, _ := json.Marshal(newParam)
				contextJSON, _ := json.Marshal(finalContext)

				orderSubmission := map[string]interface{}{
					"param":   string(paramJSON),
					"context": string(contextJSON),
					"wdtoken": b.config.WDToken,
					"udc":     b.config.UDC,
				}

				orderParamsList = append(orderParamsList, model.OrderParams{
					SubmitID:  b.UUID(),
					ItemName:  item.ItemName,
					OrderParam: orderSubmission,
				})
			}
		}
	}

	return orderParamsList
}

// generateCombineOrder generates combined order parameters
func (b *Buyer) generateCombineOrder(cartData []model.WeidianShopGroup) model.OrderParams {
	baseParam := map[string]interface{}{
		"channel":          "bjh5",
		"source_id":        b.config.SourceID,
		"biz_type":         1,
		"deliver_type":     0,
		"is_no_ship_addr":  0,
		"total_vjifen":     "",
		"wfr":              "wxBuyerShare",
		"appid":            "",
		"discount_list":    []interface{}{},
		"invalid_shop_list": []interface{}{},
		"pay_type":         0,
		"buyer": map[string]interface{}{
			"buyer_id":           b.config.BuyerID,
			"eat_in_table_name":  "",
			"address_id":         b.config.AddressID,
			"agreement_type_list": []int{5},
		},
	}

	baseContext := map[string]interface{}{
		"subChannel":    "browser",
		"thirdSubchannel": "safari",
	}

	// Get first shop group ID
	firstShopGroupID := ""
	if len(cartData) > 0 {
		firstShopGroupID = cartData[0].GroupID
	}
	finalContext := make(map[string]interface{})
	for k, v := range baseContext {
		finalContext[k] = v
	}
	finalContext["shopping_center"] = firstShopGroupID

	qPVId := b.UUID()
	baseParam["q_pv_id"] = qPVId

	// Build shop list map (group by shop)
	shopListMap := make(map[string]map[string]interface{})

	for _, shopGroup := range cartData {
		shopID := shopGroup.ShopID

		if _, exists := shopListMap[shopID]; !exists {
			shopListMap[shopID] = map[string]interface{}{
				"shop_id":           shopID,
				"f_shop_id":         "",
				"sup_id":            "",
				"item_list":         []map[string]interface{}{},
				"order_type":        3,
				"ori_price":         "0.00",
				"price":             "0.00",
				"express_fee":       "0.00",
				"express_type":      4,
				"discount_list":     []interface{}{},
				"invalid_item_list": []interface{}{},
			}
		}

		shopListItem := shopListMap[shopID]

		// Process partitions and items
		for _, partition := range shopGroup.Partitions {
			for _, item := range partition.ItemList {
				skuID := strconv.FormatInt(item.SkuID, 10)
				price := item.Price
				oriPrice := item.OriPrice

				// Accumulate prices
				priceFloat, _ := strconv.ParseFloat(price, 64)
				oriPriceFloat, _ := strconv.ParseFloat(oriPrice, 64)

				currentOriPrice, _ := strconv.ParseFloat(shopListItem["ori_price"].(string), 64)
				currentPrice, _ := strconv.ParseFloat(shopListItem["price"].(string), 64)

				shopListItem["ori_price"] = fmt.Sprintf("%.2f", currentOriPrice + oriPriceFloat * float64(item.Count))
				shopListItem["price"] = fmt.Sprintf("%.2f", currentPrice + priceFloat * float64(item.Count))

				// Add to item list
				itemList := shopListItem["item_list"].([]map[string]interface{})
				itemList = append(itemList, map[string]interface{}{
					"item_id":           item.ItemID,
					"quantity":          item.Count,
					"item_sku_id":       skuID,
					"ori_price":         oriPrice,
					"price":             price,
					"extend":            map[string]interface{}{},
					"price_type":        1,
					"discount_list":     []interface{}{},
					"item_convey_info":  map[string]interface{}{},
				})
				shopListItem["item_list"] = itemList
			}
		}
	}

	// Convert map to slice
	shopList := make([]map[string]interface{}, 0, len(shopListMap))
	for _, v := range shopListMap {
		shopList = append(shopList, v)
	}

	// Calculate total
	totalPayPrice := 0.0
	for _, shop := range shopList {
		price, _ := strconv.ParseFloat(shop["price"].(string), 64)
		totalPayPrice += price
	}

	// Build param
	newParam := make(map[string]interface{})
	for k, v := range baseParam {
		newParam[k] = v
	}
	newParam["shop_list"] = shopList
	newParam["total_pay_price"] = fmt.Sprintf("%.2f", totalPayPrice)

	// Build submission
	paramJSON, _ := json.Marshal(newParam)
	contextJSON, _ := json.Marshal(finalContext)

	orderSubmission := map[string]interface{}{
		"param":   string(paramJSON),
		"context": string(contextJSON),
		"wdtoken": b.config.WDToken,
		"udc":     b.config.UDC,
	}

	return model.OrderParams{
		SubmitID:  "combine",
		ItemName:  "合并订单",
		OrderParam: orderSubmission,
	}
}
