package model

import (
	"encoding/json"
	"time"
)

// TaskConfig represents a single order task configuration
type TaskConfig struct {
	TargetTime          string    `json:"targetTime"`           // Target time for order execution (format: "2025/12/12 16:03:00")
	AdvanceTimestamps   int       `json:"advanceTimestamps"`    // How many ms before target time to start preparing
	AdvancePostInterval int       `json:"advancePostInterval"`  // Interval between advance postings (ms)
	PostDuration        int       `json:"postDuration"`         // Duration of final sprint phase (ms)
	PostInterval        int       `json:"postInterval"`         // Interval during final sprint (ms)
	Buyers              []Buyer   `json:"buyers"`               // List of buyers for this task
	TargetTimestamp     int64     `json:"-"`                    // Parsed target timestamp (not in JSON)
}

// ParseTargetTime converts the TargetTime string to a timestamp
func (c *TaskConfig) ParseTargetTime() (int64, error) {
	layout := "2006/01/02 15:04:05"
	t, err := time.Parse(layout, c.TargetTime)
	if err != nil {
		return 0, err
	}
	return t.UnixMilli(), nil
}

// WeidianBuyerConfig represents Weidian-specific buyer configuration
type WeidianBuyerConfig struct {
	Disabled  bool   `json:"disabled"`
	BuyerName string `json:"buyer_name"`
	BuyerID   string `json:"buyer_id"`
	AddressID string `json:"address_id"`
	SourceID  string `json:"source_id"`
	ShopName  string `json:"shop_name"`
	ShopID    string `json:"shopid"`
	WDToken   string `json:"wdtoken"`
	Cookie    string `json:"cookie"`
	UDC       string `json:"udc"`
}

// YouzanBuyerConfig represents Youzan-specific buyer configuration
type YouzanBuyerConfig struct {
	Disabled       bool              `json:"disabled"`
	UserID         int64             `json:"user_id"`
	ShopName       string            `json:"shop_name"`
	KdtID          int64             `json:"kdt_id"`
	KdtSessionID   string            `json:"kdt_session_id"`
	BuyerName      string            `json:"buyer_name,omitempty"` // For compatibility
	Address        YouzanAddress     `json:"address"`
	Cookie         string            `json:"cookie"`
}

// YouzanAddress represents Youzan shipping address
type YouzanAddress struct {
	AddressDetail string `json:"addressDetail"`
	AreaCode      string `json:"areaCode"`
	City          string `json:"city"`
	County        string `json:"county"`
	Province      string `json:"province"`
	Tel           string `json:"tel"`
	UserName      string `json:"userName"`
	Recipients    string `json:"recipients"`
	AddressID     int64  `json:"addressId"`
}

// Buyer is a union type for both Weidian and Youzan buyers
type Buyer struct {
	IsWeidian bool               `json:"-"` // true if Weidian buyer
	Weidian   *WeidianBuyerConfig `json:"weidian,omitempty"`
	Youzan    *YouzanBuyerConfig  `json:"youzan,omitempty"`
}

// IsDisabled returns true if the buyer is disabled
func (b *Buyer) IsDisabled() bool {
	if b.IsWeidian {
		return b.Weidian.Disabled
	}
	return b.Youzan.Disabled
}

// GetName returns the buyer name
func (b *Buyer) GetName() string {
	if b.IsWeidian {
		return b.Weidian.BuyerName
	}
	return b.Youzan.BuyerName
}

// UnmarshalJSON implements custom JSON unmarshaling for Buyer
func (b *Buyer) UnmarshalJSON(data []byte) error {
	// Try to unmarshal as Weidian buyer first
	var weidian WeidianBuyerConfig
	if err := json.Unmarshal(data, &weidian); err == nil && weidian.BuyerID != "" {
		b.IsWeidian = true
		b.Weidian = &weidian
		return nil
	}

	// Try to unmarshal as Youzan buyer
	var youzan YouzanBuyerConfig
	if err := json.Unmarshal(data, &youzan); err == nil && youzan.UserID != 0 {
		b.IsWeidian = false
		b.Youzan = &youzan
		return nil
	}

	return nil
}

// MarshalJSON implements custom JSON marshaling for Buyer
func (b *Buyer) MarshalJSON() ([]byte, error) {
	if b.IsWeidian {
		return json.Marshal(b.Weidian)
	}
	return json.Marshal(b.Youzan)
}
