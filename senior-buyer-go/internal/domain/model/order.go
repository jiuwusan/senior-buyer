package model

import "time"

// CartItem represents an item in the shopping cart (generic structure)
type CartItem struct {
	ItemID      string  `json:"item_id"`
	ItemName    string  `json:"item_name"`
	SkuID       string  `json:"sku_id"`
	Count       int     `json:"count"`
	Price       float64 `json:"price"`
	OriPrice    float64 `json:"ori_price"`
	CreatedTime int64   `json:"created_time"`
	UpdatedTime int64   `json:"updated_time"`
}

// CartResult represents the result of a cart query
type CartResult struct {
	BuyerName  string     `json:"buyer_name"`
	OrderTotal int        `json:"order_total"`
	List       []CartItem `json:"list"`
}

// PreOrderInfo contains pre-order information
type PreOrderInfo struct {
	BuyerName    string        `json:"buyer_name"`
	OrderTotal   int           `json:"order_total"`
	OrderList    []OrderParams `json:"order_list"`
	CombineOrder OrderParams   `json:"combine_order"`
}

// OrderParams represents parameters for creating an order
type OrderParams struct {
	SubmitID  string      `json:"submit_id"`  // Unique ID for this order submission
	ItemName  string      `json:"item_name"`  // Item name for identification
	OrderParam interface{} `json:"order_param"` // Platform-specific order parameters
	Succeed   bool        `json:"succeed"`    // Whether the order has been successfully created
}

// OrderResult represents the result of an order creation attempt
type OrderResult struct {
	SubmitID  string      `json:"submit_id"`
	ItemName  string      `json:"item_name"`
	Status    string      `json:"status,omitempty"`
	Message   string      `json:"message,omitempty"`
	Result    interface{} `json:"result,omitempty"`
	BuyerName string      `json:"buyer_name,omitempty"`
}

// TargetStatusResult represents the status of target time checking
type TargetStatusResult struct {
	Status  string `json:"status"`  // "running", "timeout", "waiting"
	Message string `json:"message"` // Status message
}

// PollingConfig represents polling configuration
type PollingConfig struct {
	Polling  bool `json:"polling"`  // Whether to start/stop polling
	Interval int  `json:"interval"` // Polling interval in ms
}

// CombineConfig represents the combine order configuration
type CombineConfig struct {
	Combine bool `json:"combine"` // Whether to create combined orders
}

// WeidianCartItem represents Weidian-specific cart item structure
type WeidianCartItem struct {
	ItemID      string `json:"itemId"`
	SkuID       int64  `json:"skuId"`
	ItemName    string `json:"itemName"`
	Count       int    `json:"count"`
	Price       string `json:"price"`
	OriPrice    string `json:"oriPrice"`
	ItemInvalid bool   `json:"itemInvalid"`
	SkuInvalid  bool   `json:"skuInvalid"`
	Status      int    `json:"status"`
}

// WeidianShopGroup represents a shop group in Weidian cart
type WeidianShopGroup struct {
	GroupID    string             `json:"groupId"`
	ShopID     string             `json:"shopId"`
	Partitions []WeidianPartition `json:"partitions"`
}

// WeidianPartition represents a partition in a shop
type WeidianPartition struct {
	ItemList []WeidianCartItem `json:"itemList"`
}

// YouzanCartItem represents Youzan-specific cart item structure
type YouzanCartItem struct {
	GoodsID      int64  `json:"goods_id"`
	SkuID        int64  `json:"sku_id"`
	Num          int    `json:"num"`
	Title        string `json:"title"`
	PayPrice     float64 `json:"pay_price"`
	CreatedTime  int64  `json:"created_time"`
	UpdatedTime  int64  `json:"updated_time"`
	ActivityID   int64  `json:"activity_id"`
	ActivityType int    `json:"activity_type"`
	KdtID        int64  `json:"kdt_id"`
	DeliverTime  int64  `json:"deliver_time"`
	CartID       string `json:"cart_id"`
}

// APIResponse is the standard API response format
type APIResponse struct {
	Code int         `json:"code"`
	Msg  string      `json:"msg"`
	Data interface{} `json:"data"`
}

// Timestamp is a helper type for timestamps
type Timestamp struct {
	time.Time
}

// UnixMilli returns the timestamp in milliseconds
func (t Timestamp) UnixMilli() int64 {
	return t.Time.UnixMilli()
}

// Now returns the current timestamp
func Now() Timestamp {
	return Timestamp{Time: time.Now()}
}
